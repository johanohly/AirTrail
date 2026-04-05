<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { Plus } from '@o7/icon/lucide';
  import { isBefore } from 'date-fns';

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
  import { flightScopeState } from '$lib/state.svelte';
  import { Modal } from '$lib/components/ui/modal';
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
  import { type FlightData, kmToMiles } from '$lib/utils';
  import { Duration, nowIn } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';

  type VisitedCountryList = VisitedCountry & {
    numeric: number;
    alpha3: string;
  };

  let {
    open = $bindable<boolean>(),
    flights,
    filteredFlights,
    filters = $bindable(),
    visitedCountries = [],
    showFilters = true,
    seatUserId,
    showCountryStats = true,
  }: {
    open?: boolean;
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters: FlightFilters;
    visitedCountries?: VisitedCountryList[];
    showFilters?: boolean;
    seatUserId?: string;
    showCountryStats?: boolean;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.scope !== 'mine');

  // Only show completed flights
  const completedFlights = $derived.by(() =>
    filteredFlights.filter(
      (f) =>
        !f.date ||
        isBefore(f.arrival ? f.arrival : f.date, nowIn(f.to?.tz || 'UTC')),
    ),
  );

  let isMetric = $derived.by(() => page.data.user?.unit === 'metric');
  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      completedFlights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $derived(completedFlights.length);
  let totalDistance = $derived(
    completedFlights.reduce((acc, curr) => (acc += curr.distance ?? 0), 0),
  );
  let totalDurationParts = $derived({
    days: totalDuration.days,
    hours: totalDuration.hours,
    minutes: totalDuration.minutes,
  });
  let airports = $derived(
    new Set(
      completedFlights
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
  const ctx = $derived.by(() => ({ userId: seatUserId }));

  const activeChartData = $derived.by(() => {
    if (!activeChart) return {} as Record<string, number>;
    if (activeChart in COUNTRY_CHARTS) {
      return countryStatusData;
    }
    if (activeChart in FLIGHT_CHARTS) {
      const flightChartKey = activeChart as keyof typeof FLIGHT_CHARTS;
      return FLIGHT_CHARTS[flightChartKey].aggregate(completedFlights, ctx);
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

  $effect(() => {
    if (open) {
      setTimeout(() => {
        flightCount = flights.length;
        totalDistance = flights.reduce(
          (acc, curr) => (acc += curr.distance ?? 0),
          0,
        );
        earthCircumnavigations = totalDistance / 40075;
        const duration = Duration.fromSeconds(
          flights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
        );
        totalDurationParts = {
          days: duration.days,
          hours: duration.hours,
          minutes: duration.minutes,
        };
        airports = new Set(
          flights
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

<svelte:window
  onpopstate={() => {
    if (!open) return;
    if (activeContinent) {
      activeContinent = null;
    } else if (activeChart) {
      activeChart = null;
    }
  }}
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    if (activeContinent || activeChart) {
      history.back();
    } else if (open) {
      open = false;
    }
  }}
/>

<Modal
  bind:open
  class="max-w-full h-full overflow-y-auto rounded-none!"
  dialogOnly
  dialogNoPadding={Boolean(activeChart || activeContinent)}
  drawerNoPadding={Boolean(activeChart || activeContinent)}
  closeOnEscape={false}
  closeButton={true}
>
  {#if activeContinent}
    <BarChartDrillDown
      continent={activeContinent}
      countries={countriesByContinentDetailsData[activeContinent] || []}
      onBack={() => history.back()}
    />
  {:else if activeChart}
    <ChartDrillDown
      chartKey={activeChart}
      data={activeChartData}
      flights={completedFlights}
      onBack={() => history.back()}
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
      {#if showFilters}
        <ResponsiveFilters {flights} bind:filters />
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
              value={isMetric ? totalDistance : kmToMiles(totalDistance)}
              format={{
                style: 'unit',
                unit: isMetric ? 'kilometer' : 'mile',
                unitDisplay: 'short',
                maximumFractionDigits: 0,
              }}
            />
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
        flights={completedFlights}
        onOpenChart={(key) => {
          activeChart = key;
          history.pushState(null, '');
        }}
        {seatUserId}
      />
      <div class="flex flex-col md:flex-row gap-4">
        <FlightsPerMonth flights={completedFlights} />
        <FlightsPerWeekday flights={completedFlights} />
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
              history.pushState(null, '');
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
            history.pushState(null, '');
          }}
        />
      {/if}
    </div>
  {/if}
</Modal>
