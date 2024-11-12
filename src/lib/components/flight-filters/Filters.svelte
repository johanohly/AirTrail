<script lang="ts">
  import DateFilter from './DateFilter.svelte';
  import SelectFilter from './SelectFilter.svelte';

  import {
    defaultFilters,
    type FlightFilters,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button/index.js';
  import type { FlightData } from '$lib/utils';
  import type { Airport } from '$lib/utils/data/airports';

  let {
    flights = $bindable(),
    filters = $bindable(),
  }: {
    flights: FlightData[];
    filters: FlightFilters;
  } = $props();

  const showClear = $derived.by(
    () =>
      filters.departureAirports.length ||
      filters.arrivalAirports.length ||
      filters.fromDate ||
      filters.toDate,
  );

  const uniqueAirports = (
    flights: FlightData[],
    airportSelector: (f: FlightData) => Airport,
  ) => {
    const seenICAO = new Set();
    return flights
      .map(airportSelector)
      .filter((airport) => {
        if (seenICAO.has(airport.ICAO)) {
          return false;
        } else {
          seenICAO.add(airport.ICAO);
          return true;
        }
      })
      .map((airport) => ({
        value: airport.ICAO,
        label: `${airport.IATA ?? airport.ICAO} | ${airport.name}`,
      }));
  };

  const departureAirports = $derived.by(() => {
    if (!flights) return [];
    return uniqueAirports(flights, (f) => f.from);
  });

  const arrivalAirports = $derived.by(() => {
    if (!flights) return [];
    return uniqueAirports(flights, (f) => f.to);
  });
</script>

<SelectFilter
  bind:filterValues={filters.departureAirports}
  title="Departure Airport"
  placeholder="Search departure airports"
  disabled={flights.length === 0}
  options={departureAirports}
/>
<SelectFilter
  bind:filterValues={filters.arrivalAirports}
  title="Arrival Airport"
  placeholder="Search arrival airports"
  disabled={flights.length === 0}
  options={arrivalAirports}
/>
<DateFilter
  bind:date={filters.fromDate}
  title="From"
  iconDirection="up"
  disabled={flights.length === 0}
/>
<DateFilter
  bind:date={filters.toDate}
  title="To"
  iconDirection="down"
  disabled={flights.length === 0}
/>
{#if showClear}
  <Button
    variant="ghost"
    class="h-8 px-2 lg:px-3"
    onclick={() => {
      filters = defaultFilters;
    }}
  >
    Clear Filters
  </Button>
{/if}
