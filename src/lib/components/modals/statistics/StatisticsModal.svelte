<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { isBefore } from 'date-fns';

  import ChartDrillDown from './charts/ChartDrillDown.svelte';
  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
  import FlightsPerWeekday from './charts/FlightsPerWeekday.svelte';
  import PieCharts from './charts/PieCharts.svelte';
  import StatsCard from './StatsCard.svelte';

  import { page } from '$app/state';
  import { Modal } from '$lib/components/ui/modal';
  import { CHARTS, type ChartKey } from '$lib/stats/aggregations';
  import { type FlightData, kmToMiles } from '$lib/utils';
  import { Duration, nowIn } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';

  let {
    open = $bindable<boolean>(),
    allFlights,
    disableUserSeatFiltering = false,
  }: {
    open?: boolean;
    allFlights: FlightData[];
    disableUserSeatFiltering?: boolean;
  } = $props();

  // Only show completed flights
  const flights = $derived.by(() =>
    allFlights.filter(
      (f) =>
        !f.date ||
        isBefore(f.arrival ? f.arrival : f.date, nowIn(f.to?.tz || 'UTC')),
    ),
  );

  let isMetric = $derived.by(() => page.data.user?.unit === 'metric');
  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      flights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $state(0);
  let totalDistance = $state(0);
  let totalDurationParts = $state({ days: 0, hours: 0, minutes: 0 });
  let airports = $state(0);
  let earthCircumnavigations = $state(0);

  // Expanded chart state
  let activeChart: ChartKey | null = $state(null);
  const user = $derived(page.data.user);
  const ctx = $derived.by(() => ({ userId: user?.id }));

  const activeChartData = $derived.by(() => {
    if (!activeChart) return {} as Record<string, number>;
    return CHARTS[activeChart].aggregate(flights, ctx);
  });

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
      }, 200);
    } else {
      flightCount = 0;
      totalDistance = 0;
      totalDurationParts = { days: 0, hours: 0, minutes: 0 };
      airports = 0;
      earthCircumnavigations = 0;
    }
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    if (activeChart) {
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
  closeOnEscape={false}
>
  {#if activeChart}
    <ChartDrillDown
      chartKey={activeChart}
      data={activeChartData}
      {flights}
      onBack={() => (activeChart = null)}
    />
  {:else}
    <div class="space-y-4">
      <h2 class="text-3xl font-bold tracking-tight">Statistics</h2>
      <div class="grid gap-4 pb-2 md:grid-cols-2 lg:grid-cols-4">
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
      </div>
      <PieCharts
        {flights}
        onOpenChart={(key) => (activeChart = key)}
        {disableUserSeatFiltering}
      />
      <div class="flex flex-col md:flex-row gap-4">
        <FlightsPerMonth {flights} />
        <FlightsPerWeekday {flights} />
      </div>
    </div>
  {/if}
</Modal>
