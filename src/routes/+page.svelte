<script lang="ts">
  import { isAfter, isBefore } from 'date-fns';
  import { page } from '$app/state';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import {
    defaultFilters,
    defaultTempFilters,
    type FlightFilters,
    type TempFilters,
    type Route,
  } from '$lib/components/flight-filters/types';
  import FlightsOnboarding from '$lib/components/onboarding/FlightsOnboarding.svelte';
  import { Map } from '$lib/components/map';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { flightScopeState, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import {
    getSeatPassengerToken,
    prepareFlightData,
    type FlightData,
  } from '$lib/utils';
  import { parseLocalISO } from '$lib/utils/datetime';

  const user = $derived(page.data.user);

  const getFilterBoundary = (
    date: NonNullable<FlightFilters['fromDate']>,
    tzId: string,
    end = false,
  ) => {
    return parseLocalISO(
      `${date.toString()}T${end ? '23:59:59.999' : '00:00'}`,
      tzId,
    );
  };

  const flightListInput = writable<{
    scope: 'mine' | 'user' | 'all';
    userId?: string;
  }>({
    scope: 'mine',
  });

  $effect(() => {
    flightListInput.set({
      scope: flightScopeState.scope,
      userId:
        flightScopeState.scope === 'user' ? flightScopeState.userId : undefined,
    });
  });

  const rawFlights = trpc.flight.list.query(flightListInput);
  const rawVisitedCountries = trpc.visitedCountries.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
  });

  const visitedCountriesData = $derived.by(() => {
    const data = $rawVisitedCountries.data;
    if (!data || !data.length) return [];

    return data;
  });

  let filters: FlightFilters = $state(defaultFilters);
  let tempFilters: TempFilters = $state(defaultTempFilters);

  const effectiveSeatUserId = $derived.by(() => {
    if (flightScopeState.scope === 'all') return undefined;
    if (flightScopeState.scope === 'user') return flightScopeState.userId;
    return user?.id;
  });

  const showPassengerDetails = $derived(flightScopeState.scope !== 'mine');
  const showCountryStats = $derived(flightScopeState.scope === 'mine');

  $effect(() => {
    if (!openModalsState.listFlights) {
      tempFilters = defaultTempFilters;
    }
  });

  const matchesRoute = (f: FlightData, r: Route): boolean => {
    const fromId = f.from?.id.toString();
    const toId = f.to?.id.toString();
    return (fromId === r.a && toId === r.b) || (fromId === r.b && toId === r.a);
  };

  const filteredFlights = $derived.by(() => {
    return flights.filter((f) => {
      const fromId = f.from?.id.toString();
      const toId = f.to?.id.toString();

      if (tempFilters.routes.length || tempFilters.airportsEither.length) {
        if (
          tempFilters.routes.length &&
          !tempFilters.routes.some((r) => matchesRoute(f, r))
        ) {
          return false;
        }
        if (
          tempFilters.airportsEither.length &&
          (!fromId ||
            !toId ||
            ![fromId, toId].some((id) =>
              tempFilters.airportsEither.includes(id),
            ))
        ) {
          return false;
        }
      } else {
        if (
          filters.departureAirports.length &&
          (!fromId || !filters.departureAirports.includes(fromId))
        ) {
          return false;
        }
        if (
          filters.arrivalAirports.length &&
          (!toId || !filters.arrivalAirports.includes(toId))
        ) {
          return false;
        }
        if (
          filters.airportsEither.length &&
          (!fromId ||
            !toId ||
            ![fromId, toId].some((id) => filters.airportsEither.includes(id)))
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
        (!f.dateEnd ||
          isBefore(
            f.dateEnd,
            getFilterBoundary(filters.fromDate, f.dateEnd.timeZone ?? 'UTC'),
          ))
      ) {
        return false;
      }
      if (
        filters.toDate &&
        (!f.dateStart ||
          isAfter(
            f.dateStart,
            getFilterBoundary(
              filters.toDate,
              f.dateStart.timeZone ?? 'UTC',
              true,
            ),
          ))
      ) {
        return false;
      }

      if (
        filters.passengers.length &&
        !f.seats.some((seat) => {
          const token = getSeatPassengerToken(seat);
          return token ? filters.passengers.includes(token) : false;
        })
      ) {
        return false;
      }

      if (
        filters.airline.length &&
        !filters.airline.includes(f.airline?.name || '')
      ) {
        return false;
      }

      if (
        filters.aircraft.length &&
        !filters.aircraft.includes(f.aircraft?.name || '')
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

{#if !$rawFlights.isLoading}
  <FlightsOnboarding flightsCount={flights.length} />
{/if}
<ListFlightsModal
  bind:open={openModalsState.listFlights}
  bind:filters
  bind:tempFilters
  {flights}
  {filteredFlights}
  {deleteFlight}
  seatUserId={effectiveSeatUserId}
  {showPassengerDetails}
/>
<StatisticsModal
  bind:open={openModalsState.statistics}
  {flights}
  {filteredFlights}
  bind:filters
  visitedCountries={showCountryStats ? visitedCountriesData : []}
  seatUserId={effectiveSeatUserId}
  {showCountryStats}
/>

<Map bind:filters bind:tempFilters {flights} {filteredFlights} />
