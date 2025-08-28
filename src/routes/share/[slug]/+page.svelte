<script lang="ts">
  import { page } from '$app/state';
  import { Map } from '$lib/components/map';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';

  const slug = $derived(page.params.slug);

  const shareQuery = trpc.share.public.query({ slug });

  const flights = $derived.by(() => {
    const data = $shareQuery.data;
    if (!data?.flights?.length) return [];

    return prepareFlightData(data.flights);
  });

  let showFlightList = $state(false);
  let showStatistics = $state(false);

  const shareSettings = $derived($shareQuery.data?.settings);
  const shareStats = $derived($shareQuery.data?.stats);
</script>

<svelte:head>
  <title>Shared Flight Map - AirTrail</title>
  <meta name="description" content="View shared flight data on AirTrail" />
</svelte:head>

{#if $shareQuery.isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center space-y-4">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"
      ></div>
      <p class="text-muted-foreground">Loading shared flight data...</p>
    </div>
  </div>
{:else if $shareQuery.error}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center space-y-4 max-w-md">
      <div class="text-6xl">✈️</div>
      <h1 class="text-2xl font-bold">Share Not Found</h1>
      <p class="text-muted-foreground">
        This shared flight data is either not available, has expired, or the
        link is incorrect.
      </p>
      <a
        href="/"
        class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Go to AirTrail
      </a>
    </div>
  </div>
{:else if shareSettings && flights.length > 0}
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
          {#if shareSettings.showStats && shareStats}
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

  <!-- Map display -->
  {#if shareSettings.showMap}
    <div
      class={shareSettings.showFlightList || shareSettings.showStats
        ? 'h-full pt-14'
        : 'h-full'}
    >
      <Map {flights} filteredFlights={flights} readonly={true} />
    </div>
  {:else}
    <!-- If map is not shown, display alternative content -->
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center space-y-4 max-w-md">
        <div class="text-6xl">📊</div>
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

  <!-- Flight List Modal (if enabled) -->
  {#if shareSettings.showFlightList}
    <ListFlightsModal
      bind:open={showFlightList}
      {flights}
      filteredFlights={flights}
      readonly={true}
      filters={{
        departureAirports: [],
        arrivalAirports: [],
        fromDate: null,
        toDate: null,
        aircraftRegs: [],
      }}
    />
  {/if}

  <!-- Statistics Modal (if enabled) -->
  {#if shareSettings.showStats && shareStats}
    <StatisticsModal
      bind:open={showStatistics}
      allFlights={flights}
      readonly={true}
      sharedStats={shareStats}
    />
  {/if}
{:else if shareSettings}
  <!-- No flights in this share -->
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center space-y-4 max-w-md">
      <div class="text-6xl">✈️</div>
      <h1 class="text-2xl font-bold">No Flights to Display</h1>
      <p class="text-muted-foreground">
        This share doesn't contain any flight data, or the filters applied
        result in no visible flights.
      </p>
    </div>
  </div>
{:else}
  <!-- Fallback loading state -->
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center space-y-4">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"
      ></div>
      <p class="text-muted-foreground">Loading...</p>
    </div>
  </div>
{/if}
