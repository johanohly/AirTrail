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
  } from '$lib/components/flight-filters/types';
  import { OnResizeEnd } from '$lib/components/helpers';
  import * as Popover from '$lib/components/ui/popover';
  import {
    calculateBounds,
    prepareFlightArcData,
    type FlightData,
  } from '$lib/utils';

  let {
    flights,
    filteredFlights,
    filters = $bindable(),
  }: {
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters: FlightFilters;
  } = $props();

  let map: maplibregl.Map | undefined = $state(undefined);
  const style = $derived(
    $mode === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  const flightArcs = $derived.by(() => {
    return prepareFlightArcData(filteredFlights);
  });

  const fitFlights = () => {
    if (!map || !flightArcs) return;

    const bounds = calculateBounds(flightArcs);
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: 120,
    });
  };

  // Fit flights whenever the flights change
  $effect(() => {
    fitFlights();
  });

  const showClear = $derived.by(() => {
    return (
      filters.departureAirports.length ||
      filters.arrivalAirports.length ||
      filters.fromDate ||
      filters.toDate
    );
  });
</script>

<OnResizeEnd callback={fitFlights} />

<MapLibre
  onload={() => fitFlights()}
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
        <ControlButton onclick={() => fitFlights()} title="Show all flights">
          <Fullscreen size={20} />
        </ControlButton>
        <Popover.Root>
          <Popover.Trigger>
            <ControlButton title="Filter flights">
              <Funnel size={18} />
            </ControlButton>
          </Popover.Trigger>
          <Popover.Content
            side="right"
            class="flex flex-col flex-grow-0 gap-2 w-fit"
          >
            <Filters bind:flights bind:filters />
          </Popover.Content>
        </Popover.Root>
      </ControlGroup>
    </Control>
    <Control position="top-left">
      {#if showClear}
        <div
          class="maplibregl-ctrl-group !bg-destructive hover:!bg-destructive/80"
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

  <AirportsArcsLayer flights={filteredFlights} {flightArcs} />
</MapLibre>
