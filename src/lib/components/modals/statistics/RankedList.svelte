<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { createDetailsLookup, CHART_NOUNS } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';

  import {
    FLIGHT_CHARTS,
    toBreakdown,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';

  const VISIBLE_ROWS = 5;

  let {
    chartKey,
    flights,
    seatUserId,
    onOpen,
  }: {
    chartKey: FlightChartKey;
    flights: FlightData[];
    seatUserId?: string;
    onOpen: (key: FlightChartKey, entry?: string) => void;
  } = $props();

  const breakdown = $derived(
    toBreakdown(
      FLIGHT_CHARTS[chartKey].aggregate(flights, { userId: seatUserId }),
    ),
  );
  const visible = $derived(breakdown.entries.slice(0, VISIBLE_ROWS));
  const largest = $derived(breakdown.entries[0]?.value ?? 0);
  const detailsFor = $derived(createDetailsLookup(chartKey, flights));
</script>

<div class="min-w-0">
  <h4 class="mb-1.5 text-[13px] font-semibold">
    {FLIGHT_CHARTS[chartKey].title}
  </h4>
  <div class="space-y-0.5">
    {#each visible as { key, value } (key)}
      <BreakdownRow
        share={value / largest}
        {value}
        onclick={() => onOpen(chartKey, key)}
      >
        <BreakdownLabel {chartKey} entryKey={key} details={detailsFor(key)} />
      </BreakdownRow>
    {/each}
    {#if breakdown.missing > 0}
      <BreakdownRow
        value={breakdown.missing}
        onclick={() => onOpen(chartKey, 'No Data')}
      >
        <span class="text-muted-foreground">Not recorded</span>
      </BreakdownRow>
    {/if}
  </div>
  {#if breakdown.entries.length > VISIBLE_ROWS}
    <button
      type="button"
      class="mt-1 flex items-center gap-0.5 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      onclick={() => onOpen(chartKey)}
    >
      All {breakdown.entries.length}
      {CHART_NOUNS[chartKey][1]}
      <ChevronRight size={13} />
    </button>
  {/if}
</div>
