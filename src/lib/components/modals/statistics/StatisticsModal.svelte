<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
  import FlightsPerWeekday from './charts/FlightsPerWeekday.svelte';
  import StatsCard from './StatsCard.svelte';
  import PieCharts from './charts/PieCharts.svelte';
  import {
    type FlightData,
    formatDistance,
    formatDuration,
    formatNumber,
  } from '$lib/utils';
  import type { User } from '$lib/db';

  let {
    open = $bindable(),
    flights,
    user,
  }: {
    open?: boolean;
    flights: FlightData[];
    user: User;
  } = $props();

  let flightCount = flights.length;
  let totalDistance = flights.reduce((acc, curr) => (acc += curr.distance), 0);
  let totalDuration = flights.reduce(
    (acc, curr) => (acc += curr.duration ?? 0),
    0,
  );
  let airports = new Set(flights.flatMap((f) => [f.from.name, f.to.name])).size;
</script>

<Modal bind:open classes="h-full overflow-y-auto !rounded-none" dialogOnly>
  <div class="space-y-4">
    <h2 class="text-3xl font-bold tracking-tight">Statistics</h2>
    <div class="grid gap-4 pb-2 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard classes="py-4 px-8">
        <h3 class="text-sm font-medium">Flights</h3>
        <span class="text-2xl font-bold">{formatNumber(flightCount)}</span>
      </StatsCard>
      <StatsCard classes="py-4 px-8">
        <h3 class="text-sm font-medium">Distance</h3>
        <span class="text-2xl font-bold"
          >{formatDistance(totalDistance, user.unit === 'metric')}</span
        >
      </StatsCard>
      <StatsCard classes="py-4 px-8">
        <h3 class="text-sm font-medium">Duration</h3>
        <span class="text-2xl font-bold">{formatDuration(totalDuration)}</span>
      </StatsCard>
      <StatsCard classes="py-4 px-8">
        <h3 class="text-sm font-medium">Airports</h3>
        <span class="text-2xl font-bold">{formatNumber(airports)}</span>
      </StatsCard>
    </div>
    <PieCharts {flights} />
    <div class="flex flex-col md:flex-row gap-4">
      <FlightsPerMonth {flights} />
      <FlightsPerWeekday {flights} />
    </div>
  </div>
</Modal>
