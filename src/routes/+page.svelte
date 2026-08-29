<script lang="ts">
  import { tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
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
    setFlightScope,
  } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { Card } from '$lib/components/ui/card';
  import type { FlightScope } from '$lib/flight-scope';
  import { prepareFlightData } from '$lib/utils';

  const user = $derived(page.data.user);
  const canReadOwnFlightsAtLoad = hasClientPermission(
    page.data.authorization,
    'flight.read.own',
  );
  const canReadOwnFlights = $derived(
    hasClientPermission(page.data.authorization, 'flight.read.own'),
  );
  const canReadAnyFlights = $derived(
    hasClientPermission(page.data.authorization, 'flight.read.any'),
  );
  const canOnboardFlights = $derived(
    hasClientPermission(page.data.authorization, 'flight.create.own') ||
      hasClientPermission(page.data.authorization, 'flight.import.own'),
  );

  const flightListInput = writable<FlightScope>({ scope: 'mine' });

  $effect(() => {
    let scope = flightScopeState.current;
    if (scope.scope !== 'mine' && !canReadAnyFlights) {
      scope = { scope: 'mine' };
      setFlightScope(scope);
    }
    flightListInput.set(scope);
  });

  const rawFlights = trpc.flight.list.query(flightListInput, {
    enabled: canReadOwnFlightsAtLoad,
  });
  const rawFlightTracks = trpc.flightTrack.list.query(flightListInput, {
    enabled: canReadOwnFlightsAtLoad,
  });
  const rawVisitedCountries = trpc.visitedCountries.list.query(undefined, {
    enabled: canReadOwnFlightsAtLoad,
  });

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
    if (flightScopeState.current.scope === 'all') return undefined;
    if (flightScopeState.current.scope === 'user') {
      return flightScopeState.current.userId;
    }
    return user?.id;
  });

  const showPassengerDetails = $derived(
    flightScopeState.current.scope !== 'mine',
  );
  const showCountryStats = $derived(flightScopeState.current.scope === 'mine');
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

{#if canReadOwnFlights}
  {#if !$rawFlights.isLoading && canOnboardFlights}
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
{:else}
  <Map
    bind:filters
    bind:tempFilters
    flights={[]}
    filteredFlights={[]}
    flightTracks={[]}
    onNavigate={navigateFlights}
  />
  <div
    class="pointer-events-none fixed inset-0 z-10 grid place-items-center p-6"
  >
    <Card level="2" class="max-w-md p-6 text-center shadow-lg">
      <h1 class="text-lg font-semibold">Flight access is unavailable</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Your role does not grant access to flight data. You can still use the
        settings and tools available to your role.
      </p>
    </Card>
  </div>
{/if}
