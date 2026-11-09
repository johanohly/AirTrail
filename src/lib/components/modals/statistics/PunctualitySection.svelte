<script lang="ts">
  import { createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';

  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';

  let {
    flights,
    onOpen,
  }: {
    flights: FlightData[];
    onOpen: (key: FlightChartKey, entry?: string) => void;
  } = $props();

  const report = $derived(punctualityReport(flights));
  const largest = $derived(report.worstAirlines[0]?.totalDelayMinutes ?? 0);
  const detailsFor = $derived(createDetailsLookup('airlines', flights));
  const duration = (minutes: number) =>
    Duration.fromSeconds(minutes * 60).toString(true);
</script>

{#if report.assessedFlights === 0}
  <p class="text-sm text-muted-foreground">
    No flights have both a scheduled and an actual arrival yet.
  </p>
{:else}
  <div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
    <div>
      <div class="flex items-center gap-1 text-[13px] text-muted-foreground">
        Delayed flights
        <HelpTooltip
          text="Based on arrival vs. scheduled arrival. A flight counts as delayed when it lands more than {DELAY_THRESHOLD_MINUTES} minutes late."
        />
      </div>
      <div class="text-[26px] font-bold tracking-tight">
        {round(report.delayRate, 1)}%
      </div>
      <div class="text-[13px] text-muted-foreground">
        {report.delayedFlights} of {report.assessedFlights} assessed
      </div>
    </div>
    <div>
      <div class="text-[13px] text-muted-foreground">Total time lost</div>
      <div class="text-[26px] font-bold tracking-tight">
        {report.totalDelayMinutes > 0
          ? duration(report.totalDelayMinutes)
          : '0m'}
      </div>
      {#if report.worstDelayMinutes > 0}
        <div class="text-[13px] text-muted-foreground">
          Worst delay {duration(report.worstDelayMinutes)}
        </div>
      {/if}
    </div>
    <div class="min-w-0 sm:col-span-2 lg:col-span-1">
      <h4 class="mb-1.5 text-[13px] font-semibold">Most delays by airline</h4>
      {#if report.worstAirlines.length}
        <div class="space-y-0.5">
          {#each report.worstAirlines as airline (airline.airline)}
            <BreakdownRow
              share={airline.totalDelayMinutes / largest}
              value={duration(airline.totalDelayMinutes)}
              onclick={() =>
                onOpen(
                  'airlines',
                  airline.airline === 'Unknown airline'
                    ? 'No Data'
                    : airline.airline,
                )}
            >
              <BreakdownLabel
                chartKey="airlines"
                entryKey={airline.airline}
                details={detailsFor(airline.airline)}
              />
            </BreakdownRow>
          {/each}
        </div>
      {:else}
        <p class="px-2 text-sm text-muted-foreground">
          Every assessed flight arrived on time.
        </p>
      {/if}
    </div>
  </div>
{/if}
