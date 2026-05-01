<script lang="ts">
  import { Funnel, Fullscreen, Undo2 } from '@o7/icon/lucide';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { onDestroy, onMount } from 'svelte';
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
  import OpenAipOverlay from './OpenAipOverlay.svelte';

  import { AirportsArcsLayer } from '.';

  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import Filters from '$lib/components/flight-filters/Filters.svelte';
  import {
    defaultFilters,
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import * as Popover from '$lib/components/ui/popover';
  import {
    getDefaultAppMapStyleUrl,
    getAppMapImages,
    getConfiguredAppMapStyleUrl,
  } from '$lib/map/app-style';
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
  import {
    calculateBounds,
    cn,
    prepareFlightArcData,
    prepareVisitedAirports,
    type FlightData,
  } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  const { GlobeControl } = maplibregl;
  const unregisterPmtiles = browser ? registerPmtilesProtocol() : null;

  onDestroy(() => unregisterPmtiles?.());

  let {
    flights,
    filteredFlights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.scope !== 'mine');
  const alignStatusWithDetails = $derived(!!mapDetailsState.selection);

  let map: maplibregl.Map | undefined = $state(undefined);
  let canRenderMap = $state(!browser);
  type CameraSnapshot = {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  let previousCamera: CameraSnapshot | null = $state(null);
  let showPreviousView = $state(false);
  let programmaticCameraMove = false;
  let handledFocusRequest = $state(-1);
  const style = $derived(
    getConfiguredAppMapStyleUrl(mode.current, appConfig.config?.map),
  );
  const images = $derived(getAppMapImages(base, mode.current));
  const openAipTheme = $derived(
    (mode.current === 'dark' ? 'dark' : 'light') as OpenAipTheme,
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
    style === getDefaultAppMapStyleUrl(mode.current),
  );
  const openAipTileUrlTemplate = $derived(
    browser
      ? `${window.location.origin}${base}${OPENAIP_TILE_URL_TEMPLATE}`
      : `${base}${OPENAIP_TILE_URL_TEMPLATE}`,
  );
  const hiddenAirportLabelLayerIds = ['airport-overlay-name-label'];

  const flightArcs = $derived.by(() => {
    return prepareFlightArcData(filteredFlights);
  });

  export const fitFlights = () => {
    if (!map || !flightArcs) return;

    const bounds = calculateBounds(flightArcs);
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: 120,
    });
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
      bearing: previousCamera.bearing,
      pitch: previousCamera.pitch,
      duration: 650,
      essential: true,
    });
    previousCamera = null;
    showPreviousView = false;
  };

  const showClear = $derived.by(() => {
    return (
      filters &&
      (filters.departureAirports.length ||
        filters.arrivalAirports.length ||
        filters.airportsEither.length ||
        filters.routes.length ||
        filters.fromDate ||
        filters.toDate ||
        filters.passengers.length ||
        filters.airline.length ||
        filters.aircraft.length ||
        filters.aircraftRegs.length)
    );
  });

  const activeAirportFilter = $derived.by(() => {
    if (!filters?.airportsEither.length) return null;
    const id = filters.airportsEither[0]!;
    const airport = prepareVisitedAirports(flights).find(
      (a) => a.id.toString() === id,
    );
    return {
      id,
      label: airport ? (airport.iata ?? airport.icao) : 'Airport',
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

    return bindRuntimeMapImages(map, images);
  });

  $effect(() => {
    if (!map) return;

    const clearPreviousView = () => {
      if (programmaticCameraMove) return;
      previousCamera = null;
      showPreviousView = false;
    };

    map.on('dragstart', clearPreviousView);
    map.on('zoomstart', clearPreviousView);
    map.on('rotatestart', clearPreviousView);
    map.on('pitchstart', clearPreviousView);

    return () => {
      map.off('dragstart', clearPreviousView);
      map.off('zoomstart', clearPreviousView);
      map.off('rotatestart', clearPreviousView);
      map.off('pitchstart', clearPreviousView);
    };
  });

  $effect(() => {
    const selection = mapDetailsState.selection;
    const focusRequest = mapDetailsState.focusRequest;
    if (!map || !selection || focusRequest === handledFocusRequest) return;
    if (selection.type !== 'airport') return;

    const id = selection.airportId;

    const airport = prepareVisitedAirports(flights).find((a) => a.id === id);
    if (!airport) return;
    handledFocusRequest = focusRequest;

    const padding = $isMediumScreen
      ? { top: 40, right: 40, bottom: 40, left: 420 }
      : { top: 40, right: 20, bottom: window.innerHeight * 0.55, left: 20 };

    previousCamera = snapshotCamera();
    showPreviousView = !!previousCamera;
    markProgrammaticMove();

    map.flyTo({
      center: [airport.lon, airport.lat],
      zoom: 13,
      duration: 1200,
      essential: true,
      padding,
    });
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
      fitFlights();
    }}
    bind:map
    {style}
    diffStyleUpdates
    class="relative h-full"
    attributionControl={false}
  >
    <AttributionControl compact={true} />
    <NavigationControl position="top-right" />
    <GeolocateControl position="top-right" />
    <Control position="top-right">
      <ControlGroup>
        <MapAppearanceControl {openAipConfigured} />
      </ControlGroup>
    </Control>
    {#if flights.length}
      <Control position="top-right">
        <ControlGroup>
          <ControlButton onclick={fitFlights} title="Show all flights">
            <Fullscreen size={20} />
          </ControlButton>
          {#if filters}
            <Popover.Root>
              <Popover.Trigger>
                <ControlButton title="Filter flights">
                  <Funnel size={18} />
                </ControlButton>
              </Popover.Trigger>
              <Popover.Content
                side="left"
                class="flex w-fit grow-0 flex-col gap-2"
              >
                <Filters bind:flights bind:filters bind:tempFilters />
              </Popover.Content>
            </Popover.Root>
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
                filters = defaultFilters;
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
      {showScopeBanner}
      alignWithDetails={alignStatusWithDetails}
      onPreviousView={restorePreviousView}
      onClearAirportFilter={() => {
        if (filters) filters.airportsEither = [];
      }}
    />

    {#if openAipActive}
      <OpenAipOverlay
        tileUrlTemplate={openAipTileUrlTemplate}
        layers={openAipLayers}
      />
    {/if}

    <AirportsArcsLayer
      flights={filteredFlights}
      {flightArcs}
      bind:tempFilters
    />
  </MapLibre>
{:else}
  <MapFallback {flights} {filteredFlights} />
{/if}
