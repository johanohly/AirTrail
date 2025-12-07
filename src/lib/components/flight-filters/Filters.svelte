<script lang="ts">
  import DateFilter from './DateFilter.svelte';
  import SelectFilter from './SelectFilter.svelte';

  import {
    defaultFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import type { Airport } from '$lib/db/types';
  import type { FlightData } from '$lib/utils';

  let {
    flights = $bindable(),
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  const showClear = $derived.by(
    () =>
      filters.departureAirports.length ||
      filters.arrivalAirports.length ||
      filters.fromDate ||
      filters.toDate ||
      filters.airline.length ||
      filters.aircraftRegs.length,
  );

  const uniqueAirports = (
    flights: FlightData[],
    airportSelector: (f: FlightData) => Airport | null,
  ) => {
    const seen = new Set();
    return flights
      .map(airportSelector)
      .filter((airport): airport is Airport => !!airport)
      .filter((airport) => {
        if (seen.has(airport.id)) {
          return false;
        } else {
          seen.add(airport.id);
          return true;
        }
      })
      .map((airport) => ({
        value: airport.id.toString(),
        label: `${airport.iata ?? airport.icao} | ${airport.name}`,
        shortLabel: airport.iata ?? airport.icao,
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

  const getAirlineRegistrationsByFrequency = (flights: FlightData[]): { value: string; label: string }[] => {
    if (!flights) return [];

    const airlineFrequencyMap = flights.reduce<Map<string, number>>(
      (acc, flight) => {
        if (flight.airline) {
          let name = `${flight.airline.iata ?? flight.airline.icao} | ${flight.airline.name}`
          acc.set(name, (acc.get(name) ?? 0) + 1);
        }
        return acc;
      },
      new Map()
    );

    return Array.from(airlineFrequencyMap.entries())
      .map(([airline, count]) => ({
        airline,
        flightCount: count,
      }))
      .sort((a, b) => b.flightCount - a.flightCount)
      .map(({ airline }) => ({
        value: airline,
        label: airline,
      }));
  };

  const airline = $derived.by(() =>
    getAirlineRegistrationsByFrequency(flights),
  );

  const getAircraftRegistrationsByFrequency = (flights: FlightData[]) => {
    if (!flights) return [];

    const regFrequencyMap = flights.reduce<Map<string, number>>(
      (acc, flight) => {
        if (flight.aircraftReg) {
          acc.set(flight.aircraftReg, (acc.get(flight.aircraftReg) || 0) + 1);
        }
        return acc;
      },
      new Map(),
    );

    return Array.from(regFrequencyMap.entries())
      .map(([registration, count]) => ({
        registration,
        flightCount: count,
      }))
      .sort((a, b) => b.flightCount - a.flightCount)
      .map(({ registration }) => ({
        value: registration,
        label: registration,
      }));
  };

  const aircraftRegs = $derived.by(() =>
    getAircraftRegistrationsByFrequency(flights),
  );
</script>

{#if !hasTempFilters}
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
{/if}
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
<SelectFilter
  bind:filterValues={filters.airline}
  title="Airline"
  placeholder="Search airlines"
  disabled={!airline.length}
  options={airline}
/>
<SelectFilter
  bind:filterValues={filters.aircraftRegs}
  title="Tail Number"
  placeholder="Search tail numbers"
  disabled={!aircraftRegs.length}
  options={aircraftRegs}
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
