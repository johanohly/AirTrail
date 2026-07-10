<script lang="ts">
  import { Funnel, Fullscreen, Undo2 } from '@o7/icon/lucide';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    AttributionControl,
    Control,
    ControlButton,
    ControlGroup,
    GeolocateControl,
    MapLibre,
    NavigationControl,
  } from 'svelte-maplibre';

  import MapAppearanceControl from './MapAppearanceControl.svelte';
  import MapFallback from './MapFallback.svelte';
  import MapStatusShelf from './MapStatusShelf.svelte';
  import FlightTrackLegend from './FlightTrackLegend.svelte';
  import OpenAipOverlay from './OpenAipOverlay.svelte';
  import RainViewerLayer from './RainViewerLayer.svelte';
  import TimeOfDayLayer from './TimeOfDayLayer.svelte';

  import { AirportsArcsLayer } from '.';

  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import Filters from '$lib/components/flight-filters/Filters.svelte';
  import MobileFiltersModal from '$lib/components/flight-filters/MobileFiltersModal.svelte';
  import {
    createDefaultFilters,
    hasFlightFilters,
  } from '$lib/components/flight-filters/model';
  import {
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type Route,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import * as Popover from '$lib/components/ui/popover';
  import {
    getDefaultAppMapStyleUrl,
    getAppMapImages,
    getConfiguredAppMapStyleUrl,
  } from '$lib/map/app-style';
  import { globeCameraForArcs } from '$lib/map/globe-fit';
  import {
    initMapPreferences,
    mapPreferences,
  } from '$lib/map/map-preferences.svelte';
  import {
    getOpenAipOverlayLayers,
    OPENAIP_TILE_URL_TEMPLATE,
    type OpenAipTheme,
  } from '$lib/map/openaip';
  import { AIRPORT_DETAIL_LAYER_IDS } from '$lib/map/airport-style';
  import { registerPmtilesProtocol } from '$lib/map/pmtiles';
  import {
    bindRuntimeMapImages,
    bindStyleLayerVisibility,
    supportsMapWebGL,
  } from '$lib/map/runtime';
  import {
    appConfig,
    flightScopeState,
    flightAddedState,
    mapDetailsState,
  } from '$lib/state.svelte';
  import type { FlightTrackRow } from '$lib/track/schema';
  import {
    calculateBounds,
    cn,
    prepareFlightArcData,
    prepareVisitedAirports,
    type FlightData,
  } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const unregisterPmtiles = browser ? registerPmtilesProtocol() : null;

  onDestroy(() => unregisterPmtiles?.());

  let {
    flights,
    filteredFlights,
    flightTracks = [],
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
    flightTracks?: FlightTrackRow[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.scope !== 'mine');
  const alignStatusWithDetails = $derived(!!mapDetailsState.selection);

  let map: maplibregl.Map | undefined = $state.raw(undefined);
  let canRenderMap = $state(!browser);
  type CameraSnapshot = {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  let previousCamera: CameraSnapshot | null = $state(null);
  let filterDrawerOpen = $state(false);
  let showPreviousView = $state(false);
  let programmaticCameraMove = false;
  let handledFocusRequest = $state(-1);
  const currentTheme = $derived(mode.current ?? 'light');
  const style = $derived(
    getConfiguredAppMapStyleUrl(
      currentTheme,
      appConfig.config?.map,
      mapPreferences.basemap,
    ),
  );
  const images = $derived(getAppMapImages(base, currentTheme));
  const openAipTheme = $derived(
    (currentTheme === 'dark' ? 'dark' : 'light') as OpenAipTheme,
  );
  const openAipConfigured = $derived(
    !!appConfig.configured?.integrations?.openAipKey,
  );
  const openAipActive = $derived(
    openAipConfigured && mapPreferences.openAipEnabled,
  );
  const openAipLayers = $derived(
    getOpenAipOverlayLayers(mapPreferences.openAipGroups, openAipTheme),
  );
  const usingDefaultAppStyle = $derived(
    style === getDefaultAppMapStyleUrl(currentTheme, mapPreferences.basemap),
  );
  const openAipTileUrlTemplate = $derived(
    browser
      ? `${window.location.origin}${base}${OPENAIP_TILE_URL_TEMPLATE}`
      : `${base}${OPENAIP_TILE_URL_TEMPLATE}`,
  );
  const projection = $derived({ type: mapPreferences.projection });
  const mapRotationEnabled = $derived(mapPreferences.projection === 'mercator');
  const hiddenAirportLabelLayerIds = ['airport-overlay-name-label'];
  const airportDetailVisibility = $derived(
    mapPreferences.basemap === 'default' &&
      mapPreferences.airportOverlayDetail === 'detailed'
      ? 'visible'
      : 'none',
  );

  const resetUnsupportedCamera = (m: maplibregl.Map) => {
    const bearing = mapRotationEnabled ? m.getBearing() : 0;
    if (m.getPitch() === 0 && m.getBearing() === bearing) return;
    m.easeTo({
      pitch: 0,
      bearing,
      duration: 0,
      essential: true,
    });
  };

  const flightArcs = $derived.by(() => {
    return prepareFlightArcData(filteredFlights);
  });

  const allVisitedAirports = $derived(prepareVisitedAirports(flights));
  const allFlightArcs = $derived(prepareFlightArcData(flights));

  const detailsPanePadding = () => {
    if (!mapDetailsState.selection) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    return $isMediumScreen
      ? { top: 40, right: 40, bottom: 40, left: 420 }
      : { top: 40, right: 20, bottom: window.innerHeight * 0.55, left: 20 };
  };

  export const fitFlights = () => {
    if (!map || !flightArcs) return;

    // Add breathing-room margin on top of any current panel padding so this
    // also looks reasonable when a details panel is open. Set via setPadding
    // (no `padding` option on fitBounds) to avoid maplibre's double-counting.
    const base = detailsPanePadding();
    const padding = {
      top: base.top + 60,
      right: base.right + 60,
      bottom: base.bottom + 60,
      left: base.left + 60,
    };

    // On the globe a bounding-box fit can be unsatisfiable (flights spanning
    // more than a hemisphere make fitBounds silently give up), so fit a
    // spherical cap around the flights instead.
    if (mapPreferences.projection === 'globe') {
      const canvas = map.getCanvas();
      const camera = globeCameraForArcs(flightArcs, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        padding,
      });
      if (!camera) return;
      map.setPadding(padding);
      map.flyTo({
        center: camera.center,
        zoom: camera.zoom,
        essential: true,
      });
      return;
    }

    const bounds = calculateBounds(flightArcs);
    if (!bounds) return;

    map.setPadding(padding);
    map.fitBounds(bounds);
  };

  const snapshotCamera = (): CameraSnapshot | null => {
    if (!map) return null;
    const center = map.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  };

  const markProgrammaticMove = () => {
    if (!map) return;
    programmaticCameraMove = true;
    map.once('moveend', () => {
      programmaticCameraMove = false;
    });
  };

  const restorePreviousView = () => {
    if (!map || !previousCamera) return;
    markProgrammaticMove();
    map.easeTo({
      center: previousCamera.center,
      zoom: previousCamera.zoom,
      bearing: mapRotationEnabled ? previousCamera.bearing : 0,
      pitch: 0,
      duration: 650,
      essential: true,
    });
    previousCamera = null;
    showPreviousView = false;
  };

  const showClear = $derived(filters ? hasFlightFilters(filters) : false);

  const routeMatches = (
    item: { from: { id: number }; to: { id: number } },
    route: Route,
  ) => {
    const fromId = item.from.id.toString();
    const toId = item.to.id.toString();
    return (
      (fromId === route.a && toId === route.b) ||
      (fromId === route.b && toId === route.a)
    );
  };

  const activeAirportFilter = $derived.by(() => {
    if (!filters?.airportsEither.length) return null;
    const id = filters.airportsEither[0]!;
    const airport = allVisitedAirports.find((a) => a.id.toString() === id);
    return {
      id,
      label: airport ? (airport.iata ?? airport.icao) : 'Airport',
    };
  });

  const activeRouteFilter = $derived.by(() => {
    if (!filters?.routes.length) return null;
    const route = filters.routes[0]!;
    const arc = allFlightArcs.find((item) => routeMatches(item, route));
    return {
      id: `${route.a}-${route.b}`,
      label: arc
        ? `${arc.from.iata ?? arc.from.icao} ↔ ${arc.to.iata ?? arc.to.icao}`
        : 'Route',
    };
  });

  let previousFilteredCount = $state(0);
  const hasTempFilters = $derived(hasActiveTempFilters(tempFilters));

  $effect(() => {
    if (!flightAddedState.added) return;
    if (!map) return;
    if (!flights.length) return;

    if (filteredFlights.length) {
      fitFlights();
    }

    flightAddedState.added = false;
  });

  $effect(() => {
    const currentCount = filteredFlights.length;
    if (
      previousFilteredCount !== currentCount &&
      previousFilteredCount > 0 &&
      !hasTempFilters
    ) {
      fitFlights();
    }

    // If there are temp filters, we don't want to fit as that means the user
    // clicked on a route/airport to trigger the list view and fitting in that
    // case looks jarring.
    if (!hasTempFilters) {
      previousFilteredCount = currentCount;
    }
  });

  $effect(() => {
    if (!map) {
      return;
    }

    const openAipAirportsActive =
      openAipActive && mapPreferences.openAipGroups.includes('airports');
    const visibility =
      openAipAirportsActive && usingDefaultAppStyle ? 'none' : 'visible';

    return bindStyleLayerVisibility(
      map,
      hiddenAirportLabelLayerIds,
      visibility,
    );
  });

  $effect(() => {
    if (!map) {
      return;
    }

    return bindStyleLayerVisibility(
      map,
      AIRPORT_DETAIL_LAYER_IDS,
      airportDetailVisibility,
    );
  });

  $effect(() => {
    if (!map) {
      return;
    }

    return bindRuntimeMapImages(map, images);
  });

  // Bearing and pitch are locked in globe mode (deck.gl's globe viewport
  // cannot follow them). svelte-maplibre only applies dragRotate at map
  // creation, and touch/keyboard rotation are separate handlers it never
  // touches, so sync all rotation handlers here and square the camera up
  // whenever the projection flips.
  $effect(() => {
    const m = map;
    if (!m || !projection.type) return;
    untrack(() => {
      // Toggled on the container directly: svelte-maplibre's class prop and
      // maplibre's own imperative classList writes fight over the class
      // attribute, so a reactive class prop is unreliable here.
      m.getContainer().classList.toggle('rotation-locked', !mapRotationEnabled);
      if (mapRotationEnabled) {
        m.dragRotate.enable();
        m.keyboard.enableRotation();
        m.touchZoomRotate.enableRotation();
      } else {
        m.dragRotate.disable();
        m.keyboard.disableRotation();
        m.touchZoomRotate.disableRotation();
      }
      resetUnsupportedCamera(m);
    });
  });

  $effect(() => {
    const m = map;
    if (!m) return;

    const clearPreviousView = () => {
      if (programmaticCameraMove) return;
      previousCamera = null;
      showPreviousView = false;
    };

    m.on('dragstart', clearPreviousView);
    m.on('zoomstart', clearPreviousView);
    m.on('rotatestart', clearPreviousView);
    m.on('pitchstart', clearPreviousView);

    return () => {
      m.off('dragstart', clearPreviousView);
      m.off('zoomstart', clearPreviousView);
      m.off('rotatestart', clearPreviousView);
      m.off('pitchstart', clearPreviousView);
    };
  });

  // Drive edge padding + camera focus from details-pane state.
  //
  // When the camera moves significantly, use flyTo for its parabolic arc —
  // looks much better than easeTo's linear interpolation for big distance +
  // zoom changes (overview→airport, switching to a far-away route).
  //
  // When the camera target matches the current camera (reselect of the same
  // airport/route after a deselect), use easeTo so `padding` is interpolated
  // smoothly — flyTo treats padding as an end-state and would snap.
  //
  // Route fits go through cameraForBounds. maplibre's cameraForBounds adds
  // edge + option padding for screen size but uses ONLY option for the
  // center offset, so different (edge, option) splits with the same total
  // produce different centers. The route compute path pins the split by
  // temporarily setting persistent to target around the cameraForBounds
  // call, so a reselect after a deselect computes the same center as the
  // original open and `cameraMoved` correctly reports false.
  //
  // untrack guards every map mutation: svelte-maplibre's bind:map re-emits on
  // internal map events, so a tracked mutation here would loop.
  let prevHasSelection = false;
  let prevMediumScreen: boolean | null = null;
  let paddingInitialized = false;
  $effect(() => {
    const selection = mapDetailsState.selection;
    const focusRequest = mapDetailsState.focusRequest;
    const mediumScreen = $isMediumScreen;
    if (!map) return;

    const hasSelection = !!selection;
    const padding = detailsPanePadding();
    const needsFocus = hasSelection && focusRequest !== handledFocusRequest;
    const paddingChanged =
      paddingInitialized &&
      (prevHasSelection !== hasSelection || prevMediumScreen !== mediumScreen);

    prevHasSelection = hasSelection;
    prevMediumScreen = mediumScreen;
    paddingInitialized = true;

    if (needsFocus && selection) {
      handledFocusRequest = focusRequest;

      let targetCenter: [number, number];
      let targetZoom: number;

      if (selection.type === 'airport') {
        const airport = allVisitedAirports.find(
          (a) => a.id === selection.airportId,
        );
        if (!airport) return;
        targetCenter = [airport.lon, airport.lat];
        targetZoom = 13;
      } else {
        const arc = allFlightArcs.find((item) =>
          routeMatches(item, selection.route),
        );
        if (!arc) return;

        if (mapPreferences.projection === 'globe') {
          // Same spherical-cap fit as fitFlights: cameraForBounds can
          // silently fail on the globe for very long routes. The fit is a
          // pure function of arc + padding, so a reselect after a deselect
          // computes the same camera and `cameraMoved` stays false.
          const canvas = map.getCanvas();
          const camera = globeCameraForArcs([arc], {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            padding,
          });
          if (!camera) return;
          targetCenter = camera.center;
          targetZoom = camera.zoom;
        } else {
          const bounds = calculateBounds([arc]);
          if (!bounds) return;

          // cameraForBounds uses (edge + option) for screen size but ONLY
          // option for the center offset, so the same total split differently
          // produces different centers. Pin the split to edge=target/option=0
          // by setting persistent to target while computing — paired
          // setPadding calls within the same JS task produce no render
          // between, so no flicker.
          const target = untrack(() => {
            const saved = map!.getPadding();
            map!.setPadding(padding);
            const t = map!.cameraForBounds(bounds);
            map!.setPadding(saved);
            return t;
          });
          if (!target) return;
          if (!target.center || target.zoom === undefined) return;
          const center = maplibregl.LngLat.convert(target.center);
          targetCenter = [center.lng, center.lat];
          targetZoom = target.zoom;
        }
      }

      const currentCenter = map.getCenter();
      const cameraMoved =
        Math.abs(currentCenter.lng - targetCenter[0]) > 1e-4 ||
        Math.abs(currentCenter.lat - targetCenter[1]) > 1e-4 ||
        Math.abs(map.getZoom() - targetZoom) > 1e-2;

      previousCamera = snapshotCamera();
      showPreviousView = !!previousCamera;
      markProgrammaticMove();

      untrack(() => {
        if (cameraMoved) {
          map!.flyTo({
            center: targetCenter,
            zoom: targetZoom,
            padding,
            duration: 1200,
            essential: true,
          });
        } else {
          map!.easeTo({
            center: targetCenter,
            zoom: targetZoom,
            padding,
            duration: 300,
            essential: true,
          });
        }
      });
      return;
    }

    if (paddingChanged) {
      untrack(() => {
        map!.easeTo({
          padding,
          duration: 300,
          essential: true,
        });
      });
    }
  });

  onMount(() => {
    canRenderMap = supportsMapWebGL();
    initMapPreferences();
  });
</script>

{#if showScopeBanner}
  <div
    class={cn(
      'absolute top-3 left-1/2 z-10 w-[min(400px,calc(100%-2rem))] -translate-x-1/2 transition-[left] duration-200',
      alignStatusWithDetails ? 'md:left-[calc(50%+12rem)]' : '',
    )}
  >
    <AdminScopeBanner />
  </div>
{/if}

{#if canRenderMap}
  <MapLibre
    onload={() => {
      map?.touchPitch.disable();
      if (map) resetUnsupportedCamera(map);
      fitFlights();
    }}
    bind:map
    {style}
    {projection}
    dragRotate={mapRotationEnabled}
    pitchWithRotate={false}
    maxPitch={0}
    diffStyleUpdates
    class="relative h-full"
    attributionControl={false}
  >
    <AttributionControl compact={true} />
    <NavigationControl position="top-right" />
    <GeolocateControl position="top-right" />
    <Control position="top-right">
      <ControlGroup>
        <MapAppearanceControl
          {openAipConfigured}
          showTracksSection={flightTracks.length > 0}
        />
      </ControlGroup>
    </Control>
    {#if flights.length}
      <Control position="top-right">
        <ControlGroup>
          <ControlButton onclick={fitFlights} title="Show all flights">
            <Fullscreen size={20} />
          </ControlButton>
          {#if filters}
            {#if $isMediumScreen}
              <Popover.Root>
                <Popover.Trigger>
                  <ControlButton title="Filter flights">
                    <span class="relative inline-flex">
                      <Funnel size={18} />
                      {#if showClear || hasTempFilters}
                        <span
                          aria-hidden="true"
                          data-map-filter-dot
                          class="absolute -right-1 -top-1 size-2.5 rounded-full bg-blue-500 ring-2 ring-background"
                        ></span>
                      {/if}
                    </span>
                  </ControlButton>
                </Popover.Trigger>
                <Popover.Content
                  side="left"
                  class="flex w-fit grow-0 flex-col gap-2 p-3"
                >
                  <Filters
                    bind:flights
                    bind:filters
                    bind:tempFilters
                    layout="stacked"
                    presentation="map-popover"
                  />
                </Popover.Content>
              </Popover.Root>
            {:else}
              <ControlButton
                onclick={() => (filterDrawerOpen = true)}
                title="Filter flights"
              >
                <span class="relative inline-flex">
                  <Funnel size={18} />
                  {#if showClear || hasTempFilters}
                    <span
                      aria-hidden="true"
                      data-map-filter-dot
                      class="absolute right-0 top-0 size-2 rounded-full bg-blue-500 ring-2 ring-background"
                    ></span>
                  {/if}
                </span>
              </ControlButton>
            {/if}
          {/if}
        </ControlGroup>
      </Control>
      <Control position="top-right">
        {#if showClear}
          <div
            class="maplibregl-ctrl-group bg-destructive! hover:bg-destructive/80!"
            data-clear-ctrl
          >
            <ControlButton
              onclick={() => {
                filters = createDefaultFilters();
              }}
              title="Clear filters"
            >
              <Undo2 size={20} />
            </ControlButton>
          </div>
        {/if}
      </Control>
    {/if}

    <MapStatusShelf
      {showPreviousView}
      {activeAirportFilter}
      {activeRouteFilter}
      {showScopeBanner}
      alignWithDetails={alignStatusWithDetails}
      onPreviousView={restorePreviousView}
      onClearAirportFilter={() => {
        if (filters) filters.airportsEither = [];
      }}
      onClearRouteFilter={() => {
        if (filters) filters.routes = [];
      }}
    />

    {#if flightTracks.length > 0 && mapPreferences.routeDisplay === 'tracks' && mapPreferences.flightTrackStyle === 'altitude'}
      <FlightTrackLegend />
    {/if}

    {#if mapPreferences.timeOfDayEnabled}
      <TimeOfDayLayer />
    {/if}

    {#if mapPreferences.rainViewerEnabled}
      <RainViewerLayer />
    {/if}

    {#if openAipActive}
      <OpenAipOverlay
        tileUrlTemplate={openAipTileUrlTemplate}
        layers={openAipLayers}
      />
    {/if}

    <AirportsArcsLayer
      flights={filteredFlights}
      {flightArcs}
      {flightTracks}
      bind:tempFilters
    />
  </MapLibre>

  {#if filters && !$isMediumScreen}
    <MobileFiltersModal
      bind:open={filterDrawerOpen}
      {flights}
      bind:filters
      bind:tempFilters
    />
  {/if}
{:else}
  <MapFallback {flights} {filteredFlights} />
{/if}

<style>
  /* The compass is dead weight while rotation is locked (globe mode):
     bearing is pinned to 0 and the compass's own drag-to-rotate bypasses
     the dragRotate handler. svelte-maplibre freezes NavigationControl
     options at creation, so hide it with CSS instead of a prop.
     !important because app.css forces `display: flex !important` on all
     control-group buttons. */
  :global(.rotation-locked .maplibregl-ctrl-compass) {
    display: none !important;
  }
</style>
