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

  import { browser } from '$app/environment';
  import { base } from '$app/paths';

  import { AirportsArcsLayer } from '.';
  import MapFallback from './MapFallback.svelte';
  import OpenAipOverlay from './OpenAipOverlay.svelte';

  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import Filters from '$lib/components/flight-filters/Filters.svelte';
  import {
    getDefaultAppMapStyleUrl,
    getAppMapImages,
    getConfiguredAppMapStyleUrl,
  } from '$lib/map/app-style';
  import {
    getOpenAipOverlayLayers,
    OPENAIP_DEFAULT_ENABLED_GROUPS,
    OPENAIP_OVERLAY_STORAGE_KEY,
    OPENAIP_TILE_URL_TEMPLATE,
    type OpenAipOverlayGroup,
    type OpenAipTheme,
  } from '$lib/map/openaip';
  import { registerPmtilesProtocol } from '$lib/map/pmtiles';
  import {
    bindRuntimeMapImages,
    bindStyleLayerVisibility,
    loadBooleanMapPreference,
    storeBooleanMapPreference,
    supportsMapWebGL,
  } from '$lib/map/runtime';
  import { appConfig, flightScopeState } from '$lib/state.svelte';
  import {
    defaultFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import * as Popover from '$lib/components/ui/popover';
  import { flightAddedState } from '$lib/state.svelte';
  import {
    calculateBounds,
    prepareFlightArcData,
    type FlightData,
  } from '$lib/utils';

  const { GlobeControl } = maplibregl;
  const unregisterPmtiles = browser ? registerPmtilesProtocol() : null;

  onDestroy(() => unregisterPmtiles?.());

  let {
    flights,
    filteredFlights,
    filters = $bindable(),
    tempFilters = $bindable(),
    openAipGroups = $bindable([...OPENAIP_DEFAULT_ENABLED_GROUPS]),
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
    openAipGroups?: OpenAipOverlayGroup[];
  } = $props();

  const showScopeBanner = $derived(flightScopeState.scope !== 'mine');

  let map: maplibregl.Map | undefined = $state(undefined);
  let canRenderMap = $state(!browser);
  let openAipEnabled = $state(false);
  let openAipPreferenceLoaded = $state(false);
  const style = $derived(
    getConfiguredAppMapStyleUrl(mode.current, appConfig.config?.map),
  );
  const images = $derived(getAppMapImages(base, mode.current));
  const openAipTheme = $derived(
    (mode.current === 'dark' ? 'dark' : 'light') as OpenAipTheme,
  );
  const showOpenAipToggle = $derived(
    !!appConfig.configured?.integrations?.openAipKey,
  );
  const openAipLayers = $derived(
    getOpenAipOverlayLayers(openAipGroups, openAipTheme),
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

  const showClear = $derived.by(() => {
    return (
      filters &&
      (filters.departureAirports.length ||
        filters.arrivalAirports.length ||
        filters.fromDate ||
        filters.toDate ||
        filters.aircraftRegs.length)
    );
  });

  let previousFilteredCount = $state(0);
  const hasTempFilters = $derived(
    tempFilters &&
      (tempFilters.routes.length > 0 || tempFilters.airportsEither.length > 0),
  );

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
    if (showOpenAipToggle) {
      return;
    }

    openAipEnabled = false;
  });

  $effect(() => {
    if (!browser || !openAipPreferenceLoaded) {
      return;
    }

    storeBooleanMapPreference(OPENAIP_OVERLAY_STORAGE_KEY, openAipEnabled);
  });

  $effect(() => {
    if (!map) {
      return;
    }

    const visibility =
      openAipEnabled && usingDefaultAppStyle ? 'none' : 'visible';

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

  onMount(() => {
    canRenderMap = supportsMapWebGL();
    openAipEnabled = loadBooleanMapPreference(OPENAIP_OVERLAY_STORAGE_KEY);
    openAipPreferenceLoaded = true;
  });
</script>

{#if showScopeBanner}
  <div
    class="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[min(400px,calc(100%-2rem))]"
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
    <NavigationControl />
    <GeolocateControl />
    {#if showOpenAipToggle}
      <Control position="top-left">
        <ControlGroup>
          <ControlButton
            onclick={() => {
              openAipEnabled = !openAipEnabled;
            }}
            title={openAipEnabled
              ? 'Hide OpenAIP airspaces overlay'
              : 'Show OpenAIP airspaces overlay'}
          >
            <span
              class="text-[11px] font-semibold tracking-wide"
              class:text-primary={openAipEnabled}
            >
              AIP
            </span>
          </ControlButton>
        </ControlGroup>
      </Control>
    {/if}
    {#if flights.length}
      <Control position="top-left">
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
                side="right"
                class="flex flex-col grow-0 gap-2 w-fit"
              >
                <Filters bind:flights bind:filters bind:tempFilters />
              </Popover.Content>
            </Popover.Root>
          {/if}
        </ControlGroup>
      </Control>
      <Control position="top-left">
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

    {#if openAipEnabled && showOpenAipToggle}
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
