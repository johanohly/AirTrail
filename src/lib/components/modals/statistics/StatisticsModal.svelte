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
  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import * as Select from '$lib/components/ui/select';
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
    allFlights,
    visitedCountries = [],
    disableUserSeatFiltering = false,
  }: {
    open?: boolean;
    allFlights: FlightData[];
    visitedCountries?: VisitedCountryList[];
    disableUserSeatFiltering?: boolean;
  } = $props();

  let selectedYear = $state('all');

  const years = $derived.by(() => {
    const years = new Set<string>();
    allFlights.forEach((f) => {
      if (f.date) {
        years.add(f.date.getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  });

  // Only show completed flights
  const flights = $derived.by(() =>
    allFlights.filter(
      (f) =>
        (!f.date ||
          isBefore(f.arrival ? f.arrival : f.date, nowIn(f.to?.tz || 'UTC'))) &&
        (selectedYear === 'all' ||
          f.date?.getFullYear().toString() === selectedYear),
    ),
  );

  let isMetric = $derived.by(() => page.data.user?.unit === 'metric');
  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      flights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $derived(flights.length);
  let totalDistance = $derived(
    flights.reduce((acc, curr) => (acc += curr.distance ?? 0), 0),
  );
  let totalDurationParts = $derived({
    days: totalDuration.days,
    hours: totalDuration.hours,
    minutes: totalDuration.minutes,
  });
  let airports = $derived(
    new Set(
      flights
        .filter((f) => f.from && f.to)
        .flatMap((f) => [f.from!.name, f.to!.name]),
    ).size,
  );
  let countriesCount = $derived(
    selectedYear === 'all'
      ? visitedCountries.filter(
          (c) => c.status === 'visited' || c.status === 'lived',
        ).length
      : new Set(
          flights
            .filter((f) => f.from && f.to)
            .flatMap((f) => [f.from!.country, f.to!.country]),
        ).size,
  );
  let earthCircumnavigations = $derived(totalDistance / 40075);

  // Expanded chart state
  let activeChart: ChartKey | null = $state(null);
  let activeContinent: string | null = $state(null);
  const user = $derived(page.data.user);
  const ctx = $derived.by(() => ({ userId: user?.id }));

  const activeChartData = $derived.by(() => {
    if (!activeChart) return {} as Record<string, number>;
    if (activeChart in COUNTRY_CHARTS) {
      return countryStatusData;
    }
    if (activeChart in FLIGHT_CHARTS) {
      const flightChartKey = activeChart as keyof typeof FLIGHT_CHARTS;
      return FLIGHT_CHARTS[flightChartKey].aggregate(flights, ctx);
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
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    if (activeContinent) {
      activeContinent = null;
    } else if (activeChart) {
      activeChart = null;
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
      onBack={() => (activeContinent = null)}
    />
  {:else if activeChart}
    <ChartDrillDown
      chartKey={activeChart}
      data={activeChartData}
      {flights}
      onBack={() => (activeChart = null)}
    />
  {:else}
    <div class="space-y-4">
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between pr-2 sm:pr-4 md:pr-8"
      >
        <h2 class="text-3xl font-bold tracking-tight">Statistics</h2>
        <div class="mt-3 sm:mt-0">
          <Select.Root type="single" bind:value={selectedYear}>
            <Select.Trigger class="w-[180px]">
              {selectedYear === 'all' ? 'All Time' : selectedYear}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all" label="All Time" />
              {#each years as year}
                <Select.Item value={year} label={year} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>
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
      </div>
      <h3 class="text-2xl font-bold tracking-tight pt-4">Flight Statistics</h3>
      <PieCharts
        {flights}
        onOpenChart={(key) => (activeChart = key)}
        {disableUserSeatFiltering}
      />
      <div class="flex flex-col md:flex-row gap-4">
        <FlightsPerMonth {flights} />
        <FlightsPerWeekday {flights} />
      </div>
      {#if selectedYear === 'all'}
        <h3 class="text-2xl font-bold tracking-tight pt-4">
          Country Statistics
        </h3>
        <div class="grid gap-4 pb-2 md:grid-cols-2 xl:grid-cols-3">
          <div
            class="cursor-pointer"
            onclick={() => (activeChart = 'visited-country-status')}
          >
            <PieChart title="Visited Country Status" data={countryStatusData} />
          </div>
        </div>
        <BarChart
          title="Countries by Continent"
          data={countriesByContinentData}
          onBarClick={(continent) => (activeContinent = continent)}
        />
      {/if}
    </div>
  {/if}
</Modal>
