<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import DateFilter from './DateFilter.svelte';
  import SelectFilter from './SelectFilter.svelte';
  import type { FlightData } from '$lib/utils';
  import type { Airport } from '$lib/utils/data/airports';
  import type { ToolbarFilters } from './types';

  let {
    flights = $bindable(),
    filters = $bindable(),
  }: {
    flights: FlightData[];
    filters: ToolbarFilters;
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
  options={departureAirports}
/>
<SelectFilter
  bind:filterValues={filters.arrivalAirports}
  title="Arrival Airport"
  placeholder="Search arrival airports"
  options={arrivalAirports}
/>
<DateFilter bind:date={filters.fromDate} title="From" iconDirection="up" />
<DateFilter bind:date={filters.toDate} title="To" iconDirection="down" />
{#if showClear}
  <Button
    variant="ghost"
    class="h-8 px-2 lg:px-3"
    onclick={() => {
      filters = {
        departureAirports: [],
        arrivalAirports: [],
        fromDate: undefined,
        toDate: undefined,
      };
    }}
  >
    Clear Filters
  </Button>
{/if}
