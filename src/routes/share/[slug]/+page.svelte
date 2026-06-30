<script lang="ts">
  import type { inferRouterOutputs } from '@trpc/server';
  import { ChartPie } from '@o7/icon/lucide';
  import { AirplanemodeInactive } from '@o7/icon/material/solid';
  import { writable } from 'svelte/store';

  import { page } from '$app/state';
  import { createDefaultFilters } from '$lib/components/flight-filters/model';
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import { Map } from '$lib/components/map';
  import type { Flight, FlightSeat } from '$lib/db/types';
  import type { AppRouter } from '$lib/server/routes/_app';
  import type { FlightTrackRow } from '$lib/track/schema';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { clearFlightListFocus, focusFlightInList } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';

  type ShareFlight =
    inferRouterOutputs<AppRouter>['share']['public']['flights'][number];

  function normalizeSharedFlight(flight: ShareFlight) {
    return {
      ...flight,
      date: flight.date ?? null,
      datePrecision: flight.datePrecision ?? 'day',
      departure: flight.departure ?? null,
      arrival: flight.arrival ?? null,
      departureScheduled: flight.departureScheduled ?? null,
      arrivalScheduled: flight.arrivalScheduled ?? null,
      takeoffScheduled: flight.takeoffScheduled ?? null,
      takeoffActual: flight.takeoffActual ?? null,
      landingScheduled: flight.landingScheduled ?? null,
      landingActual: flight.landingActual ?? null,
      departureTerminal: null,
      departureGate: null,
      arrivalTerminal: null,
      arrivalGate: null,
      flightNumber: flight.flightNumber ?? null,
      aircraftReg: flight.aircraftReg ?? null,
      note: null,
      airline: flight.airline ?? null,
      aircraft: flight.aircraft ?? null,
      seats: flight.seats.map((seat) => ({
        ...seat,
        user: 'user' in seat ? (seat.user as FlightSeat['user']) : null,
      })),
    };
  }

  const shareInput = writable({ slug: page.params.slug ?? '' });

  $effect(() => {
    shareInput.set({ slug: page.params.slug ?? '' });
  });

  const shareQuery = trpc.share.public.query(shareInput);

  const flights = $derived.by(() => {
    const data = $shareQuery.data;
    if (!data?.flights?.length) return [];

    return prepareFlightData(
      data.flights.map(normalizeSharedFlight) as unknown as Flight[],
    );
  });

  const flightTracks = $derived.by((): FlightTrackRow[] => {
    const data = $shareQuery.data;
    if (!data?.flights?.length) return [];

    return data.flights.flatMap((flight) =>
      flight.track
        ? [
            {
              flightId: flight.id,
              ...flight.track,
              pointCount: flight.track.coordinates.length,
            },
          ]
        : [],
    );
  });

  let showFlightList = $state(false);
  let showStatistics = $state(false);
  let flightListOpenedFromStatistics = $state(false);
  let filters: FlightFilters = $state(createDefaultFilters());

  const shareSettings = $derived($shareQuery.data?.settings);

  const openSharedFlightInList = (flightId: number) => {
    focusFlightInList(flightId);
    flightListOpenedFromStatistics = true;
    showFlightList = true;
  };

  $effect(() => {
    if (!showFlightList) {
      flightListOpenedFromStatistics = false;
    }
  });

  $effect(() => {
    return () => {
      clearFlightListFocus();
    };
  });
</script>

<svelte:head>
  <title>Shared Flight Map - JFlights</title>
  <meta name="description" content="View shared flight data on AirTrail" />
</svelte:head>

{#if shareSettings && flights.length > 0}
  <!-- Navigation bar for accessible modals -->
  {#if shareSettings.showFlightList || shareSettings.showStats}
    <nav
      class="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b"
    >
      <div
        class="container mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center space-x-2">
          <div class="text-lg font-semibold">Shared Flights</div>
          <div class="text-sm text-muted-foreground">
            ({flights.length} flights)
          </div>
        </div>
        <div class="flex items-center space-x-2">
          {#if shareSettings.showFlightList}
            <button
              onclick={() => (showFlightList = true)}
              class="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Flight List
            </button>
          {/if}
          {#if shareSettings.showStats}
            <button
              onclick={() => (showStatistics = true)}
              class="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Statistics
            </button>
          {/if}
        </div>
      </div>
    </nav>
  {/if}

  {#if shareSettings.showMap}
    <div
      class={shareSettings.showFlightList || shareSettings.showStats
        ? 'h-full pt-14'
        : 'h-full'}
    >
      <Map {flights} filteredFlights={flights} {flightTracks} />
    </div>
  {:else}
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center flex flex-col items-center space-y-4 max-w-md">
        <ChartPie size={64} class="text-primary" />
        <h1 class="text-2xl font-bold">Shared Flight Data</h1>
        <p class="text-muted-foreground">
          This share includes {flights.length} flights.
          {#if shareSettings.showFlightList || shareSettings.showStats}
            Use the buttons above to explore the data.
          {:else}
            The map view is not available for this share.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  {#if shareSettings.showFlightList}
    <ListFlightsModal
      bind:open={showFlightList}
      {flights}
      filteredFlights={flights}
      readonly={true}
    />
  {/if}

  {#if shareSettings.showStats}
    <StatisticsModal
      bind:open={showStatistics}
      {flights}
      filteredFlights={flights}
      {filters}
      showFilters={false}
      showCountryStats={false}
      onOpenFlight={shareSettings.showFlightList
        ? openSharedFlightInList
        : undefined}
      suppressEscapeNavigation={flightListOpenedFromStatistics &&
        showFlightList}
    />
  {/if}
{:else if shareSettings}
  <div class="flex items-center justify-center min-h-screen">
    <div class="flex flex-col items-center text-center space-y-4 max-w-md">
      <AirplanemodeInactive size={64} class="text-primary" />
      <h1 class="text-2xl font-bold">No Flights to Display</h1>
      <p class="text-muted-foreground">
        This share doesn't contain any flight data, or the filters applied
        result in no visible flights.
      </p>
    </div>
  </div>
{/if}
