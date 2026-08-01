<script lang="ts">
  import { tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
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
  import { Map } from '$lib/components/map';
  import { MapDetailsPane } from '$lib/components/map-details';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import FlightsOnboarding from '$lib/components/onboarding/FlightsOnboarding.svelte';
  import { createFlightNavigator } from '$lib/flight-navigation';
  import { includeFocusedFlightInList } from '$lib/flight-visibility';
  import { waitForModalHistoryIdle } from '$lib/components/ui/modal/modal-history';
  import {
    closeMapDetails,
    flightScopeState,
    focusFlightInList,
    mapDetailsState,
    openFlightDetails,
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

  $effect(() => {
    const selection = mapDetailsState.selection;
    if ($rawFlights.isLoading || selection?.type !== 'flight') return;
    if (flights.some((flight) => flight.id === selection.flightId)) return;
    closeMapDetails();
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
  let focusedListFlightId = $state<number | null>(null);

  $effect(() => {
    if (!openModalsState.listFlights) {
      tempFilters = createDefaultTempFilters();
      focusedListFlightId = null;
    }
  });

  const filteredFlights = $derived.by(() => {
    return flights.filter((flight) => matchesFlight(flight, filters));
  });

  const filteredDrilldownFlights = $derived.by(() => {
    const locationFilters = hasActiveTempFilters(tempFilters)
      ? tempFilters
      : filters;

    return flights.filter(
      (flight) =>
        matchesLocationFilters(flight, locationFilters) &&
        matchesNonLocationFilters(flight, filters),
    );
  });

  const focusedListResult = $derived.by(() =>
    includeFocusedFlightInList(
      filteredDrilldownFlights,
      flights,
      focusedListFlightId,
    ),
  );
  const drilldownFlights = $derived(focusedListResult.flights);
  const focusedFlightOutsideFilters = $derived(
    focusedListResult.focusedFlightOutsideFilters,
  );

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

  const navigateFlights = createFlightNavigator({
    getState: () => ({
      tempFilters,
      focusedListFlightId,
      listOpen: openModalsState.listFlights,
      statisticsOpen: openModalsState.statistics,
    }),
    commitState: (next) => {
      tempFilters = next.tempFilters;
      focusedListFlightId = next.focusedListFlightId;
      Object.assign(openModalsState, {
        listFlights: next.listOpen,
        statistics: next.statisticsOpen,
      });
    },
    focusFlightInList,
    waitForModalClose: async () => {
      await tick();
      await waitForModalHistoryIdle();
    },
    openFlightDetails,
  });

  const openStatisticsFlight = (flightId: number) => {
    return navigateFlights({
      destination: 'list',
      focus: { type: 'flight', flightId },
    });
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
  {focusedFlightOutsideFilters}
  {deleteFlight}
  seatUserId={effectiveSeatUserId}
  {showPassengerDetails}
  onNavigate={navigateFlights}
/>
<StatisticsModal
  bind:open={openModalsState.statistics}
  {flights}
  {filteredFlights}
  bind:filters
  visitedCountries={showCountryStats ? visitedCountriesData : []}
  seatUserId={effectiveSeatUserId}
  {showCountryStats}
  onOpenFlight={openStatisticsFlight}
/>

<Map
  bind:filters
  bind:tempFilters
  {flights}
  {filteredFlights}
  {flightTracks}
  onNavigate={navigateFlights}
/>
<MapDetailsPane
  {flights}
  bind:filters
  seatUserId={effectiveSeatUserId}
  onNavigate={navigateFlights}
/>
