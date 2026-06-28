<script lang="ts">
  import { page } from '$app/state';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import {
    createDefaultFilters,
    matchesFlight,
    matchesLocationFilters,
    matchesNonLocationFilters,
  } from '$lib/components/flight-filters/model';
  import {
    createDefaultTempFilters,
    hasTempFilters as hasActiveTempFilters,
    type FlightFilters,
    type TempFilters,
  } from '$lib/components/flight-filters/types';
  import FlightsOnboarding from '$lib/components/onboarding/FlightsOnboarding.svelte';
  import { MapDetailsPane } from '$lib/components/map-details';
  import { Map } from '$lib/components/map';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import {
    flightScopeState,
    focusFlightInList,
    openModalsState,
  } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';

  const user = $derived(page.data.user);

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

  let filters: FlightFilters = $state(createDefaultFilters());
  let tempFilters: TempFilters = $state(createDefaultTempFilters());

  const effectiveSeatUserId = $derived.by(() => {
    if (flightScopeState.scope === 'all') return undefined;
    if (flightScopeState.scope === 'user') return flightScopeState.userId;
    return user?.id;
  });

  const showPassengerDetails = $derived(flightScopeState.scope !== 'mine');
  const showCountryStats = $derived(flightScopeState.scope === 'mine');
  let flightListOpenedFromStatistics = $state(false);
  let releaseStatisticsNavigationPauseTimer: ReturnType<
    typeof setTimeout
  > | null = null;

  $effect(() => {
    if (openModalsState.listFlights) {
      if (releaseStatisticsNavigationPauseTimer) {
        clearTimeout(releaseStatisticsNavigationPauseTimer);
        releaseStatisticsNavigationPauseTimer = null;
      }
      return;
    }

    if (!openModalsState.listFlights) {
      tempFilters = createDefaultTempFilters();
    }

    if (
      flightListOpenedFromStatistics &&
      !releaseStatisticsNavigationPauseTimer
    ) {
      releaseStatisticsNavigationPauseTimer = setTimeout(() => {
        flightListOpenedFromStatistics = false;
        releaseStatisticsNavigationPauseTimer = null;
      }, 250);
    }
  });

  const filteredFlights = $derived.by(() => {
    return flights.filter((flight) => matchesFlight(flight, filters));
  });

  const drilldownFlights = $derived.by(() => {
    const locationFilters = hasActiveTempFilters(tempFilters)
      ? tempFilters
      : filters;

    return flights.filter(
      (flight) =>
        matchesLocationFilters(flight, locationFilters) &&
        matchesNonLocationFilters(flight, filters),
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

  const openFlightInList = (flightId: number) => {
    focusFlightInList(flightId);
    flightListOpenedFromStatistics = true;
    openModalsState.listFlights = true;
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
  onOpenFlight={openFlightInList}
  pauseDrilldownNavigation={flightListOpenedFromStatistics}
/>

<Map bind:filters bind:tempFilters {flights} {filteredFlights} {flightTracks} />
<MapDetailsPane {flights} bind:filters bind:tempFilters />
