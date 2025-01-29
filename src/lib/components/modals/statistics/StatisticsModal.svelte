<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { isBefore } from 'date-fns';

  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
  import FlightsPerWeekday from './charts/FlightsPerWeekday.svelte';
  import PieCharts from './charts/PieCharts.svelte';
  import StatsCard from './StatsCard.svelte';

  import { page } from '$app/stores';
  import { Modal } from '$lib/components/ui/modal';
  import { type FlightData, formatDuration, kmToMiles } from '$lib/utils';
  import { Duration, nowIn } from '$lib/utils/datetime';

  let {
    open = $bindable<boolean>(),
    allFlights,
  }: {
    open?: boolean;
    allFlights: FlightData[];
  } = $props();

  // Only show completed flights
  const flights = $derived.by(() =>
    allFlights.filter((f) =>
      isBefore(f.arrival ? f.arrival : f.date, nowIn(f.to.tz)),
    ),
  );

  let isMetric = $derived.by(() => $page.data.user?.unit === 'metric');
  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      flights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $state(0);
  let totalDistance = $state(0);
  let totalDurationParts = $state({ days: 0, hours: 0, minutes: 0 });
  let airports = $state(0);
  $effect(() => {
    if (open) {
      setTimeout(() => {
        flightCount = flights.length;
        totalDistance = flights.reduce(
          (acc, curr) => (acc += curr.distance ?? 0),
          0,
        );
        const duration = Duration.fromSeconds(
          flights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
        );
        totalDurationParts = {
          days: duration.days,
          hours: duration.hours,
          minutes: duration.minutes,
        };
        airports = new Set(flights.flatMap((f) => [f.from.name, f.to.name]))
          .size;
      }, 200);
    } else {
      flightCount = 0;
      totalDistance = 0;
      totalDurationParts = { days: 0, hours: 0, minutes: 0 };
      airports = 0;
    }
  });
</script>

<Modal
  bind:open
  class="max-w-full h-full overflow-y-auto !rounded-none"
  dialogOnly
>
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
    <PieCharts {flights} />
    <div class="flex flex-col md:flex-row gap-4">
      <FlightsPerMonth {flights} />
      <FlightsPerWeekday {flights} />
    </div>
  </div>
</Modal>
