<script lang="ts">
  import ColumnChart from './ColumnChart.svelte';

  import { countFlightsPerYear } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';

  let {
    flights,
    selected = [],
    onSelect,
    compact = false,
  }: {
    flights: FlightData[];
    selected?: number[];
    onSelect?: (year: number) => void;
    compact?: boolean;
  } = $props();

  const data = $derived(
    countFlightsPerYear(flights).map(({ year, flights: value }) => ({
      key: year,
      label: String(year),
      name: String(year),
      value,
    })),
  );
</script>

{#if data.length}
  <ColumnChart
    {data}
    {selected}
    {onSelect}
    {compact}
    tickSpacing={44}
    testId="flights-per-year"
  />
{:else}
  <p class="text-sm text-muted-foreground">No flights with a date</p>
{/if}
