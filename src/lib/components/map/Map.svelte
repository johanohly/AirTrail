<script lang="ts">
  import { Funnel, Fullscreen, Undo2 } from '@o7/icon/lucide';
  import maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import {
    AttributionControl,
    Control,
    ControlButton,
    ControlGroup,
    GeolocateControl,
    MapLibre,
    NavigationControl,
  } from 'svelte-maplibre';

  import { AirportsArcsLayer } from '.';

  import Filters from '$lib/components/flight-filters/Filters.svelte';
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

  let map: maplibregl.Map | undefined = $state(undefined);
  const style = $derived(
    mode.current === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

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
</script>

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

  <AirportsArcsLayer flights={filteredFlights} {flightArcs} bind:tempFilters />
</MapLibre>
