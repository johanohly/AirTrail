<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { Plane } from '@o7/icon/lucide';

  import StatsCard from '../StatsCard.svelte';

  import { aircraftReport, type TopEntry } from '$lib/stats/aggregations';
  import { type FlightData } from '$lib/utils';

  let {
    flights,
    seatUserId,
  }: {
    flights: FlightData[];
    seatUserId?: string;
  } = $props();

  const report = $derived(aircraftReport(flights, { userId: seatUserId }));
</script>

{#snippet entryRow(
  label: string,
  entry: TopEntry | null,
  unit: string,
  mono = false,
)}
  <div class="flex items-center justify-between gap-4 py-2.5">
    <span class="text-sm text-muted-foreground">{label}</span>
    {#if entry}
      <div class="text-right">
        <div
          class="text-sm font-semibold text-foreground"
          class:font-mono={mono}
        >
          {entry.label}
        </div>
        <div class="text-xs text-muted-foreground">
          <NumberFlow value={entry.count} />
          {unit}
        </div>
      </div>
    {:else}
      <span class="text-xs text-muted-foreground">No data</span>
    {/if}
  </div>
{/snippet}

<StatsCard
  class="bg-linear-to-br from-blue-500/10 to-violet-500/10 border-blue-400/40 px-5 py-4 dark:border-blue-500/20"
>
  <div class="mb-2 flex items-center gap-2">
    <Plane size={18} class="text-blue-500" />
    <h3 class="text-base font-semibold">Aircraft</h3>
  </div>
  <div class="divide-y divide-border/60">
    <div class="flex items-center justify-between gap-4 py-2.5">
      <span class="text-sm text-muted-foreground">Aircraft types flown</span>
      <span class="text-lg font-bold text-foreground">
        <NumberFlow value={report.typeCount} />
      </span>
    </div>
    {@render entryRow('Most flown aircraft', report.mostFlownType, 'flights')}
    {@render entryRow('Most flown tail', report.mostFlownTail, 'flights', true)}
    {@render entryRow('Top seat class', report.topSeatClass, 'flights')}
    {@render entryRow('Top seat position', report.topSeatPosition, 'times')}
    {@render entryRow('Main flight reason', report.topReason, 'flights')}
  </div>
</StatsCard>
