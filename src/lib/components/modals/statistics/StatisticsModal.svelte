<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { Plus } from '@o7/icon/lucide';

  import BarChart from './charts/BarChart.svelte';
  import BarChartDrillDown from './charts/BarChartDrillDown.svelte';
  import ChartDrillDown from './charts/ChartDrillDown.svelte';
  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
  import FlightsPerWeekday from './charts/FlightsPerWeekday.svelte';
  import PieChart from './charts/PieChart.svelte';
  import PieCharts from './charts/PieCharts.svelte';
  import StatsCard from './StatsCard.svelte';

  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { flightScopeState } from '$lib/state.svelte';
  import { Modal } from '$lib/components/ui/modal';
  import type { ModalHistoryHandle } from '$lib/components/ui/modal/modal-history';
  import ResponsiveFilters from '$lib/components/flight-filters/ResponsiveFilters.svelte';
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import { type VisitedCountry, wasVisited } from '$lib/db/types';
  import {
    COUNTRY_BAR_CHARTS,
    COUNTRY_CHARTS,
    countriesByContinentDetails,
    FLIGHT_CHARTS,
    type ChartKey,
  } from '$lib/stats/aggregations';
  import {
    readIncludeUpcoming,
    writeIncludeUpcoming,
  } from '$lib/stats/upcoming-storage';
  import { pluralize, type FlightData } from '$lib/utils';
  import { isCompletedFlight } from '$lib/utils/data/flight-timeline';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  let {
    open = $bindable<boolean>(),
    flights,
    filteredFlights,
    filters = $bindable(),
    visitedCountries = [],
    showFilters = true,
    seatUserId,
    showCountryStats = true,
    onOpenFlight,
  }: {
    open?: boolean;
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters: FlightFilters;
    visitedCountries?: VisitedCountry[];
    showFilters?: boolean;
    seatUserId?: string;
    showCountryStats?: boolean;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.current.scope !== 'mine');

  let includeUpcoming = $state(readIncludeUpcoming());
  // Same rule as the flight list, so both agree on what is upcoming
  const completedFlights = $derived(
    filteredFlights.filter((f) => isCompletedFlight(f.raw)),
  );
  const upcomingCount = $derived(
    filteredFlights.length - completedFlights.length,
  );
  const countedFlights = $derived(
    includeUpcoming ? filteredFlights : completedFlights,
  );

  const prefs = $derived(getPreferences(page.data.user));
  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      countedFlights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $derived(countedFlights.length);
  let totalDistance = $derived(
    countedFlights.reduce((acc, curr) => (acc += curr.distance ?? 0), 0),
  );
  let totalDurationParts = $derived({
    days: totalDuration.days,
    hours: totalDuration.hours,
    minutes: totalDuration.minutes,
  });
  let airports = $derived(
    new Set(
      countedFlights
        .filter((f) => f.from && f.to)
        .flatMap((f) => [f.from!.name, f.to!.name]),
    ).size,
  );
  let countriesCount = $derived(
    visitedCountries.filter(
      (c) => c.status === 'visited' || c.status === 'lived',
    ).length,
  );
  let earthCircumnavigations = $derived(totalDistance / 40075);

  // Expanded chart state
  let activeChart: ChartKey | null = $state(null);
  let activeContinent: string | null = $state(null);
  let modalHistory: ModalHistoryHandle | undefined = $state();
  let wasOpen = $state(false);
  const ctx = $derived.by(() => ({ userId: seatUserId }));

  const activeChartData = $derived.by(() => {
    if (!activeChart) return {} as Record<string, number>;
    if (activeChart in COUNTRY_CHARTS) {
      return countryStatusData;
    }
    if (activeChart in FLIGHT_CHARTS) {
      const flightChartKey = activeChart as keyof typeof FLIGHT_CHARTS;
      return FLIGHT_CHARTS[flightChartKey].aggregate(countedFlights, ctx);
    }
    return {} as Record<string, number>;
  });

  // Country statistics
  const countryStatusData = $derived.by(() =>
    COUNTRY_CHARTS['visited-country-status'].aggregate(visitedCountries),
  );

  const countriesByContinentData = $derived.by(() =>
    COUNTRY_BAR_CHARTS['countries-by-continent'].aggregate(visitedCountries),
  );

  const countriesByContinentDetailsData = $derived.by(() =>
    countriesByContinentDetails(visitedCountries),
  );

  const pushDrilldownHistory = () => {
    modalHistory?.push({ activeChart, activeContinent });
  };

  const restoreDrilldown = (state: unknown) => {
    const drilldown = state as
      { activeChart?: unknown; activeContinent?: unknown } | undefined;
    const chart = drilldown?.activeChart;
    activeChart =
      typeof chart === 'string' &&
      (chart in FLIGHT_CHARTS || chart in COUNTRY_CHARTS)
        ? (chart as ChartKey)
        : null;
    activeContinent =
      typeof drilldown?.activeContinent === 'string'
        ? drilldown.activeContinent
        : null;
  };

  $effect(() => {
    const closedFromDrilldown =
      wasOpen && !open && (activeChart || activeContinent);
    wasOpen = open;

    if (closedFromDrilldown) {
      activeChart = null;
      activeContinent = null;
    }

    if (open) {
      setTimeout(() => {
        flightCount = countedFlights.length;
        totalDistance = countedFlights.reduce(
          (acc, curr) => (acc += curr.distance ?? 0),
          0,
        );
        earthCircumnavigations = totalDistance / 40075;
        const duration = Duration.fromSeconds(
          countedFlights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
        );
        totalDurationParts = {
          days: duration.days,
          hours: duration.hours,
          minutes: duration.minutes,
        };
        airports = new Set(
          countedFlights
            .filter((f) => f.from && f.to)
            .flatMap((f) => [f.from!.name, f.to!.name]),
        ).size;
        countriesCount = visitedCountries.filter(wasVisited).length;
      }, 200);
    } else {
      flightCount = 0;
      totalDistance = 0;
      totalDurationParts = { days: 0, hours: 0, minutes: 0 };
      airports = 0;
      countriesCount = 0;
      earthCircumnavigations = 0;
    }
  });
</script>

{#snippet upcomingSwitch()}
  <!-- Switch after the text, so a right thumb tapping it doesn't cover the
       label that says what it does -->
  <label class="flex items-center gap-2 text-sm text-muted-foreground">
    <!-- Trimmed to the capital letters, so centering lines the switch up
         with the letters in whatever font the device falls back to. Browsers
         without text-box center on the line box instead -->
    <span class="[text-box:trim-both_cap_alphabetic]">
      {includeUpcoming ? 'Including' : 'Excluding'}
      {upcomingCount} upcoming {pluralize(upcomingCount, 'flight')}
    </span>
    <Switch
      checked={includeUpcoming}
      onCheckedChange={(value) => {
        includeUpcoming = value;
        writeIncludeUpcoming(value);
      }}
    />
  </label>
{/snippet}

<Modal
  bind:open
  bind:historyHandle={modalHistory}
  class="max-w-full h-full overflow-y-auto rounded-none!"
  dialogOnly
  dialogNoPadding={Boolean(activeChart || activeContinent)}
  drawerNoPadding={Boolean(activeChart || activeContinent)}
  closeButton={true}
  onHistoryStateChange={restoreDrilldown}
>
  {#if activeContinent}
    <BarChartDrillDown
      continent={activeContinent}
      countries={countriesByContinentDetailsData[activeContinent] || []}
      onBack={() => modalHistory?.back()}
    />
  {:else if activeChart}
    <ChartDrillDown
      chartKey={activeChart}
      data={activeChartData}
      flights={countedFlights}
      onBack={() => modalHistory?.back()}
      {onOpenFlight}
      {seatUserId}
    />
  {:else}
    <div class="space-y-4">
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between pr-2 sm:pr-4 md:pr-8"
      >
        <h2 class="text-3xl font-bold tracking-tight">Statistics</h2>
      </div>
      {#if showScopeBanner}
        <AdminScopeBanner />
      {/if}
      {#if showFilters || upcomingCount > 0}
        <div class="flex items-start gap-3">
          {#if showFilters}
            <div class="flex-1">
              <ResponsiveFilters {flights} bind:filters />
            </div>
          {/if}
          {#if upcomingCount > 0}
            <!-- As tall as the Filter button, so the switch stays level with
                 it when added filters wrap onto more lines -->
            <div class="ml-auto flex h-8 min-w-0 items-center">
              {@render upcomingSwitch()}
            </div>
          {/if}
        </div>
      {/if}
      <div class="grid gap-4 pb-2 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard class="py-4 px-8">
          <h3 class="text-sm font-medium">Flights</h3>
          <span class="text-2xl font-bold">
            <NumberFlow value={flightCount} />
          </span>
        </StatsCard>
        <StatsCard class="py-4 px-8">
          <h3 class="text-sm font-medium">Distance</h3>
          <span class="text-2xl font-bold">
            <NumberFlow
              value={convertDistance(totalDistance, prefs)}
              format={{ maximumFractionDigits: 0 }}
            />
            <span class="text-lg font-medium">
              {distanceUnitLabel(prefs)}
            </span>
            (<NumberFlow value={round(earthCircumnavigations, 2)} />x 🌎)
          </span>
        </StatsCard>
        <StatsCard class="py-4 px-8">
          <h3 class="text-sm font-medium">Duration</h3>
          <span class="text-2xl font-bold">
            {#if totalDuration.days}
              <NumberFlow value={totalDurationParts.days} />d
            {/if}
            {#if totalDuration.hours}
              <NumberFlow value={totalDurationParts.hours} />h
            {/if}
            {#if totalDuration.minutes}
              <NumberFlow value={totalDurationParts.minutes} />m
            {:else if !totalDuration.days && !totalDuration.hours}
              0m
            {/if}
          </span>
        </StatsCard>
        <StatsCard class="py-4 px-8">
          <h3 class="text-sm font-medium">Airports</h3>
          <span class="text-2xl font-bold">
            <NumberFlow value={airports} />
          </span>
        </StatsCard>
        {#if showCountryStats}
          <StatsCard class="py-4 px-8">
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col">
                <h3 class="text-sm font-medium">Countries</h3>
                <span class="text-2xl font-bold">
                  <NumberFlow value={countriesCount} />
                </span>
              </div>
              {#if countriesCount === 0}
                <Button
                  href={resolve('/visited-countries')}
                  variant="secondary"
                  size="sm"
                >
                  <Plus size={16} />
                  Add
                </Button>
              {/if}
            </div>
          </StatsCard>
        {/if}
      </div>
      <h3 class="text-2xl font-bold tracking-tight pt-4">Flight Statistics</h3>
      <PieCharts
        flights={countedFlights}
        onOpenChart={(key) => {
          activeChart = key;
          pushDrilldownHistory();
        }}
        {seatUserId}
      />
      <div class="flex flex-col md:flex-row gap-4">
        <FlightsPerMonth flights={countedFlights} />
        <FlightsPerWeekday flights={countedFlights} />
      </div>
      {#if showCountryStats}
        <h3 class="text-2xl font-bold tracking-tight pt-4">
          Country Statistics
        </h3>
        <div class="grid gap-4 pb-2 md:grid-cols-2 xl:grid-cols-3">
          <div
            class="cursor-pointer"
            onclick={() => {
              activeChart = 'visited-country-status';
              pushDrilldownHistory();
            }}
          >
            <PieChart title="Visited Country Status" data={countryStatusData} />
          </div>
        </div>
        <BarChart
          title="Countries by Continent"
          data={countriesByContinentData}
          onBarClick={(continent) => {
            activeContinent = continent;
            pushDrilldownHistory();
          }}
        />
      {/if}
    </div>
  {/if}
</Modal>
