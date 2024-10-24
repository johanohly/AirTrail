<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import Filter from './Filter.svelte';
  import type { FlightData } from '$lib/utils';
  import type { Airport } from '$lib/utils/data/airports';

  let {
    flights = $bindable(),
    filters = $bindable(),
  }: {
    flights: FlightData[];
    filters: {
      from: string[];
      to: string[];
    };
  } = $props();

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

<div class="flex gap-2">
  <Filter
    bind:filterValues={filters.from}
    title="Departure"
    placeholder="Search departure airports"
    options={departureAirports}
  />
  <Filter
    bind:filterValues={filters.to}
    title="Arrival"
    placeholder="Search arrival airports"
    options={arrivalAirports}
  />
  {#if Object.values(filters).flat().length > 0}
    <Button
      variant="ghost"
      class="h-8 px-2 lg:px-3"
      onclick={() => {
        filters = { from: [], to: [] };
      }}
    >
      Clear Filters
    </Button>
  {/if}
</div>
