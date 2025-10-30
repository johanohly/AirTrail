<script lang="ts">
  import { isAfter, isBefore } from 'date-fns';
  import { toast } from 'svelte-sonner';

  import {
    defaultFilters,
    defaultTempFilters,
    type FlightFilters,
    type TempFilters,
    type Route,
  } from '$lib/components/flight-filters/types';
  import { Map } from '$lib/components/map';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData, type FlightData } from '$lib/utils';

  const rawFlights = trpc.flight.list.query();
  const rawVisitedCountries = trpc.visitedCountries.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
  });

  const visitedCountriesData = $derived.by(() => {
    const data = $rawVisitedCountries.data;
    if (!data || !data.length) return [];

    return data.filter(
      (country) => country.status === 'visited' || country.status === 'lived',
    );
  });

  let filters: FlightFilters = $state(defaultFilters);
  let tempFilters: TempFilters = $state(defaultTempFilters);

  $effect(() => {
    if (!openModalsState.listFlights) {
      tempFilters = defaultTempFilters;
    }
  });

  const matchesRoute = (f: FlightData, r: Route): boolean => {
    const fromId = f.from.id.toString();
    const toId = f.to.id.toString();
    return (fromId === r.a && toId === r.b) || (fromId === r.b && toId === r.a);
  };

  const filteredFlights = $derived.by(() => {
    return flights.filter((f) => {
      const fromId = f.from.id.toString();
      const toId = f.to.id.toString();

      if (tempFilters.routes.length || tempFilters.airportsEither.length) {
        if (
          tempFilters.routes.length &&
          !tempFilters.routes.some((r) => matchesRoute(f, r))
        ) {
          return false;
        }
        if (
          tempFilters.airportsEither.length &&
          ![fromId, toId].some((id) => tempFilters.airportsEither.includes(id))
        ) {
          return false;
        }
      } else {
        if (
          filters.departureAirports.length &&
          !filters.departureAirports.includes(fromId)
        ) {
          return false;
        }
        if (
          filters.arrivalAirports.length &&
          !filters.arrivalAirports.includes(toId)
        ) {
          return false;
        }
        if (
          filters.airportsEither.length &&
          ![fromId, toId].some((id) => filters.airportsEither.includes(id))
        ) {
          return false;
        }
        if (
          filters.routes.length &&
          !filters.routes.some((r) => matchesRoute(f, r))
        ) {
          return false;
        }
      }

      if (
        filters.fromDate &&
        isBefore(f.date, filters.fromDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      }
      if (
        filters.toDate &&
        isAfter(f.date, filters.toDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      }

      if (
        filters.aircraftRegs.length &&
        !filters.aircraftRegs.includes(f.aircraftReg || '')
      ) {
        return false;
      }

      return true;
    });
  });

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

  const deleteFlight = async (id: number) => {
    const toastId = toast.loading('Deleting flight...');
    try {
      await $deleteFlightMutation.mutateAsync(id);
      toast.success('Flight deleted', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete flight', { id: toastId });
    }
  };
</script>

<ListFlightsModal
  bind:open={openModalsState.listFlights}
  bind:filters
  bind:tempFilters
  {flights}
  {filteredFlights}
  {deleteFlight}
/>
<StatisticsModal
  bind:open={openModalsState.statistics}
  allFlights={filteredFlights}
  visitedCountries={visitedCountriesData}
/>

<Map bind:filters bind:tempFilters {flights} {filteredFlights} />
