<script lang="ts">
  import { Funnel, Fullscreen, Undo2 } from '@o7/icon/lucide';
  import type { Map as MapLibreMap } from 'maplibre-gl';
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

  import FlightTrackLegend from './FlightTrackLegend.svelte';
  import MapAppearanceControl from './MapAppearanceControl.svelte';
  import MapFallback from './MapFallback.svelte';
  import MapStatusShelf from './MapStatusShelf.svelte';
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
    routeMatchesEndpoints,
    type FlightFilters,
    type Route,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import * as Popover from '$lib/components/ui/popover';
  import type { NavigateFlights } from '$lib/flight-navigation';
  import { includeFocusedRouteOnMap } from '$lib/flight-visibility';
  import { AIRPORT_DETAIL_LAYER_IDS } from '$lib/map/airport-style';
  import {
    getDefaultAppMapStyleUrl,
    getAppMapImages,
    getConfiguredAppMapStyleUrl,
  } from '$lib/map/app-style';
  import {
    createMapCameraController,
    type CameraFocusTarget,
    type MapCameraController,
  } from '$lib/map/camera-controller';
  import { hasFallbackFlightArcs } from '$lib/map/flight-layer-data';
  import {
    initMapPreferences,
    mapPreferences,
  } from '$lib/map/map-preferences.svelte';
  import {
    getOpenAipOverlayLayers,
    OPENAIP_TILE_URL_TEMPLATE,
    type OpenAipTheme,
  } from '$lib/map/openaip';
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
    onNavigate,
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
    flightTracks?: FlightTrackRow[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
    onNavigate?: NavigateFlights;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.scope !== 'mine');
  const alignStatusWithDetails = $derived(!!mapDetailsState.selection);

  let map: MapLibreMap | undefined = $state.raw(undefined);
  let cameraController: MapCameraController | undefined = $state.raw(undefined);
  let canRenderMap = $state(!browser);
  let filterDrawerOpen = $state(false);
  let showPreviousView = $state(false);
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

  // Details focus is a temporary view, not a persistent filter. Flight details
  // isolate one flight. Route details retain the filtered map and add any
  // flights on the focused route that the persistent filters excluded.
  const drawnFlights = $derived.by(() => {
    const selection = mapDetailsState.selection;
    if (selection?.type === 'flight') {
      return flights.filter((flight) => flight.id === selection.flightId);
    }
    return includeFocusedRouteOnMap(
      filteredFlights,
      flights,
      selection?.type === 'route' ? selection.route : null,
    );
  });
  const flightArcs = $derived.by(() => {
    return prepareFlightArcData(drawnFlights);
  });
  const overviewFlightArcs = $derived.by(() => {
    return prepareFlightArcData(filteredFlights);
  });
  const trackFlightIds = $derived(
    new Set(flightTracks.map((track) => track.flightId)),
  );
  const hasFallbackArcs = $derived(
    hasFallbackFlightArcs(flightArcs, trackFlightIds),
  );

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

  let automaticFitRequest = $state(0);
  const requestAutomaticFit = () => {
    automaticFitRequest += 1;
  };

  export const fitFlights = () => {
    cameraController?.fit(flightArcs, {
      projection: mapPreferences.projection,
      padding: detailsPanePadding(),
    });
  };

  const restorePreviousView = () => {
    cameraController?.restore(mapRotationEnabled);
  };

  const showClear = $derived(filters ? hasFlightFilters(filters) : false);

  const routeMatches = (
    item: { from: { id: number }; to: { id: number } },
    route: Route,
  ) => {
    return routeMatchesEndpoints(item.from.id, item.to.id, route);
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
      requestAutomaticFit();
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
      requestAutomaticFit();
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
      cameraController?.normalizeOrientation(mapRotationEnabled);
    });
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
  $effect(() => {
    const selection = mapDetailsState.selection;
    const focusRequest = mapDetailsState.focusRequest;
    const controller = cameraController;
    if (!controller) return;

    const padding = detailsPanePadding();
    let focusTarget: CameraFocusTarget | undefined;

    if (selection) {
      if (selection.type === 'airport') {
        const airport = allVisitedAirports.find(
          (a) => a.id === selection.airportId,
        );
        if (airport) {
          focusTarget = {
            type: 'point',
            center: [airport.lon, airport.lat],
            zoom: 13,
          };
        }
      } else {
        // route or flight — both fit a single great-circle arc between two
        // airports, resolved by airport ID straight from the flights. The
        // deduplicated arc list (allFlightArcs) is keyed by airport *name*, so
        // two distinct airport pairs sharing a name collapse into one arc under
        // the first pair's IDs; an ID lookup there would miss the second pair
        // and leave the map unfocused.
        const arc = (() => {
          if (selection.type === 'flight') {
            const f = flights.find((fl) => fl.id === selection.flightId);
            return f?.from && f.to ? { from: f.from, to: f.to } : null;
          }
          const route = selection.route;
          const f = flights.find(
            (fl) =>
              fl.from != null &&
              fl.to != null &&
              routeMatches({ from: fl.from, to: fl.to }, route),
          );
          return f?.from && f.to ? { from: f.from, to: f.to } : null;
        })();
        if (arc) {
          focusTarget = {
            type: 'arcs',
            arcs: [arc],
            projection: mapPreferences.projection,
          };
        }
      }
    }

    controller.reconcile({
      selectionActive: !!selection,
      focusRequest,
      focusTarget,
      padding,
      projection: mapPreferences.projection,
      overviewArcs: overviewFlightArcs,
      automaticFitRequest,
    });
  });

  $effect(() => {
    const m = map;
    if (!m) return;

    const controller = createMapCameraController(m, {
      onPreviousViewChange: (available) => {
        showPreviousView = available;
      },
    });
    cameraController = controller;

    return () => {
      controller.destroy();
      if (cameraController === controller) cameraController = undefined;
    };
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
      cameraController?.normalizeOrientation(mapRotationEnabled);
      requestAutomaticFit();
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
          {hasFallbackArcs}
          showTracksSection={flightTracks.length > 0}
        />
      </ControlGroup>
    </Control>
    {#if flights.length}
      <Control position="top-right">
        <ControlGroup>
          <ControlButton onclick={fitFlights} title="Fit visible flights">
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

    {#if flightTracks.length > 0 && mapPreferences.routeDisplay === 'tracks' && mapPreferences.flightTrackStyle === 'altitude' && !showPreviousView}
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
      flights={drawnFlights}
      {flightArcs}
      {flightTracks}
      bind:tempFilters
      {onNavigate}
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
