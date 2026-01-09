<script lang="ts">
  import DateFilter from './DateFilter.svelte';
  import SelectFilter from './SelectFilter.svelte';

  import {
    defaultFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import type { Airline, Airport } from '$lib/db/types';
  import type { FlightData } from '$lib/utils';
  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';

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
      filters.aircraft.length ||
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

  const airlineData = $derived.by(() => {
    if (!flights) return { options: [], byName: new Map<string, Airline>() };

    const frequencyMap = new Map<string, number>();
    const byName = new Map<string, Airline>();

    for (const flight of flights) {
      if (flight.airline) {
        frequencyMap.set(
          flight.airline.name,
          (frequencyMap.get(flight.airline.name) ?? 0) + 1,
        );
        byName.set(flight.airline.name, flight.airline);
      }
    }

    const options = Array.from(frequencyMap.entries())
      .map(([name, count]) => ({ name, flightCount: count }))
      .sort((a, b) => b.flightCount - a.flightCount)
      .map(({ name }) => ({ value: name, label: name }));

    return { options, byName };
  });

  const airline = $derived(airlineData.options);

  const getAircraftByFrequency = (flights: FlightData[]) => {
    if (!flights) return [];

    const aircraftFrequencyMap = flights.reduce<Map<string, number>>(
      (acc, flight) => {
        if (flight.aircraft) {
          acc.set(
            flight.aircraft.name,
            (acc.get(flight.aircraft.name) || 0) + 1,
          );
        }
        return acc;
      },
      new Map(),
    );

    return Array.from(aircraftFrequencyMap.entries())
      .map(([aircraft, count]) => ({
        aircraft,
        flightCount: count,
      }))
      .sort((a, b) => b.flightCount - a.flightCount)
      .map(({ aircraft }) => ({
        value: aircraft,
        label: aircraft,
      }));
  };

  const aircraft = $derived.by(() => getAircraftByFrequency(flights));

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
    triggerIcon="depart"
    disabled={flights.length === 0}
    options={departureAirports}
  />
  <SelectFilter
    bind:filterValues={filters.arrivalAirports}
    title="Arrival Airport"
    placeholder="Search arrival airports"
    triggerIcon="arrive"
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
  triggerIcon="airline"
  disabled={!airline.length}
  options={airline}
>
  {#snippet itemIcon(value)}
    <AirlineIcon airline={airlineData.byName.get(value) ?? null} />
  {/snippet}
</SelectFilter>
<SelectFilter
  bind:filterValues={filters.aircraft}
  title="Aircraft"
  placeholder="Search aircraft"
  triggerIcon="plane"
  disabled={!aircraft.length}
  options={aircraft}
/>
<SelectFilter
  bind:filterValues={filters.aircraftRegs}
  title="Tail Number"
  placeholder="Search tail numbers"
  triggerIcon="plane"
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
