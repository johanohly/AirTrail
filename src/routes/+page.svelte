<script lang="ts">
  import { isAfter, isBefore } from 'date-fns';
  import { page } from '$app/state';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import {
    createDefaultTempFilters,
    defaultFilters,
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type MultiOptionFilterOperator,
    type OptionFilterOperator,
    type TempFilters,
    type Route,
  } from '$lib/components/flight-filters/types';
  import FlightsOnboarding from '$lib/components/onboarding/FlightsOnboarding.svelte';
  import { MapDetailsPane } from '$lib/components/map-details';
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
  const rawFlightTracks = trpc.flightTrack.list.query(flightListInput);
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

  const flightTracks = $derived.by(() => {
    const data = $rawFlightTracks.data;
    if (!data || !data.length) return [];

    return data;
  });

  let filters: FlightFilters = $state(defaultFilters);
  let tempFilters: TempFilters = $state(createDefaultTempFilters());

  const effectiveSeatUserId = $derived.by(() => {
    if (flightScopeState.scope === 'all') return undefined;
    if (flightScopeState.scope === 'user') return flightScopeState.userId;
    return user?.id;
  });

  const showPassengerDetails = $derived(flightScopeState.scope !== 'mine');
  const showCountryStats = $derived(flightScopeState.scope === 'mine');

  $effect(() => {
    if (!openModalsState.listFlights) {
      tempFilters = createDefaultTempFilters();
    }
  });

  const matchesRoute = (f: FlightData, r: Route): boolean => {
    const fromId = f.from?.id.toString();
    const toId = f.to?.id.toString();
    return (fromId === r.a && toId === r.b) || (fromId === r.b && toId === r.a);
  };

  const optionMatches = (
    value: string | null | undefined,
    selectedValues: string[],
    operator: OptionFilterOperator = 'is any of',
  ) => {
    if (!selectedValues.length) return true;
    if (!value) return false;

    const found = selectedValues.includes(value);

    switch (operator) {
      case 'is':
      case 'is any of':
        return found;
      case 'is not':
      case 'is none of':
        return !found;
    }
  };

  const multiOptionMatches = (
    values: string[],
    selectedValues: string[],
    operator: MultiOptionFilterOperator = 'include any of',
  ) => {
    if (!selectedValues.length) return true;

    const selected = new Set(selectedValues);
    const matchCount = values.filter((value) => selected.has(value)).length;

    switch (operator) {
      case 'include':
      case 'include any of':
        return matchCount > 0;
      case 'exclude':
      case 'exclude if any of':
        return matchCount === 0;
      case 'include all of':
        return matchCount === selectedValues.length;
      case 'exclude if all':
        return matchCount !== selectedValues.length;
    }
  };

  const matchesLocationFilters = (
    f: FlightData,
    locationFilters: Pick<FlightFilters, 'airportsEither' | 'routes'> &
      Partial<
        Pick<
          FlightFilters,
          | 'departureAirports'
          | 'departureAirportsOperator'
          | 'arrivalAirports'
          | 'arrivalAirportsOperator'
        >
      >,
  ) => {
    const fromId = f.from?.id.toString();
    const toId = f.to?.id.toString();
    const departureAirports = locationFilters.departureAirports ?? [];
    const arrivalAirports = locationFilters.arrivalAirports ?? [];

    if (
      !optionMatches(
        fromId,
        departureAirports,
        locationFilters.departureAirportsOperator,
      )
    ) {
      return false;
    }
    if (
      !optionMatches(
        toId,
        arrivalAirports,
        locationFilters.arrivalAirportsOperator,
      )
    ) {
      return false;
    }
    if (
      locationFilters.airportsEither.length &&
      (!fromId ||
        !toId ||
        ![fromId, toId].some((id) =>
          locationFilters.airportsEither.includes(id),
        ))
    ) {
      return false;
    }
    if (
      locationFilters.routes.length &&
      !locationFilters.routes.some((r) => matchesRoute(f, r))
    ) {
      return false;
    }

    return true;
  };

  const matchesNonLocationFilters = (f: FlightData) => {
    if (
      !optionMatches(
        f.date?.getFullYear().toString(),
        filters.years,
        filters.yearsOperator,
      )
    ) {
      return false;
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
      !multiOptionMatches(
        f.seats
          .map((seat) => getSeatPassengerToken(seat))
          .filter((token): token is string => !!token),
        filters.passengers,
        filters.passengersOperator,
      )
    ) {
      return false;
    }

    if (
      !optionMatches(f.airline?.name, filters.airline, filters.airlineOperator)
    ) {
      return false;
    }

    if (
      !optionMatches(
        f.aircraft?.name,
        filters.aircraft,
        filters.aircraftOperator,
      )
    ) {
      return false;
    }

    if (
      !optionMatches(
        f.aircraftReg,
        filters.aircraftRegs,
        filters.aircraftRegsOperator,
      )
    ) {
      return false;
    }

    return true;
  };

  const filteredFlights = $derived.by(() => {
    return flights.filter(
      (f) => matchesLocationFilters(f, filters) && matchesNonLocationFilters(f),
    );
  });

  const drilldownFlights = $derived.by(() => {
    const locationFilters = hasActiveTempFilters(tempFilters)
      ? tempFilters
      : filters;

    return flights.filter(
      (f) =>
        matchesLocationFilters(f, locationFilters) &&
        matchesNonLocationFilters(f),
    );
  });

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
      trpc.flightTrack.list.utils.invalidate();
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
  filteredFlights={drilldownFlights}
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

<Map bind:filters bind:tempFilters {flights} {filteredFlights} {flightTracks} />
<MapDetailsPane {flights} bind:filters bind:tempFilters />
