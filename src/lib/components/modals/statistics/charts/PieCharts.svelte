<script lang="ts">
  import PieChart from './PieChart.svelte';

  import { page } from '$app/state';
  import { type FlightData } from '$lib/utils';
  import { CHARTS, type ChartKey } from '$lib/stats/aggregations';

  let {
    flights,
    onOpenChart,
  }: { flights: FlightData[]; onOpenChart?: (key: ChartKey) => void } =
    $props();

  const user = $derived(page.data.user);

  const ctx = $derived.by(() => ({ userId: user?.id }));

  const seatDistribution = $derived.by(() =>
    CHARTS['seat'].aggregate(flights, ctx),
  );
  const seatClassDistribution = $derived.by(() =>
    CHARTS['seat-class'].aggregate(flights, ctx),
  );
  const reasonDistribution = $derived.by(() =>
    CHARTS['reason'].aggregate(flights, ctx),
  );
  const continentDistribution = $derived.by(() =>
    CHARTS['continents'].aggregate(flights, ctx),
  );

  const topAirlineDistribution = $derived.by(() =>
    CHARTS['airlines'].aggregate(flights, ctx, { limit: 5 }),
  );
  const topAircraftDistribution = $derived.by(() =>
    CHARTS['aircraft-models'].aggregate(flights, ctx, { limit: 5 }),
  );
  const topAircraftRegDistribution = $derived.by(() =>
    CHARTS['aircraft-regs'].aggregate(flights, ctx, { limit: 5 }),
  );
  const topAirportDistribution = $derived.by(() =>
    CHARTS['airports'].aggregate(flights, ctx, { limit: 5 }),
  );
  const topRouteDistribution = $derived.by(() =>
    CHARTS['routes'].aggregate(flights, ctx, { limit: 5 }),
  );
</script>

<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
  <div class="cursor-pointer" onclick={() => onOpenChart?.('seat-class')}>
    <PieChart data={seatClassDistribution} title="Seat Class" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('seat')}>
    <PieChart data={seatDistribution} title="Seat Preference" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('reason')}>
    <PieChart data={reasonDistribution} title="Flight Reasons" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('continents')}>
    <PieChart data={continentDistribution} title="Continents" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('airlines')}>
    <PieChart data={topAirlineDistribution} title="Top Airlines" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('aircraft-models')}>
    <PieChart data={topAircraftDistribution} title="Top Aircraft Models" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('aircraft-regs')}>
    <PieChart
      data={topAircraftRegDistribution}
      title="Top Specific Aircrafts"
    />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('airports')}>
    <PieChart data={topAirportDistribution} title="Top Visited Airports" />
  </div>
  <div class="cursor-pointer" onclick={() => onOpenChart?.('routes')}>
    <PieChart data={topRouteDistribution} title="Top Routes" />
  </div>
</div>
