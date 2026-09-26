<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { CircleCheck, Gauge } from '@o7/icon/lucide';

  import StatsCard from '../StatsCard.svelte';

  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
  } from '$lib/stats/aggregations';
  import { type FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';

  let {
    flights,
  }: {
    flights: FlightData[];
  } = $props();

  const report = $derived(punctualityReport(flights));

  const formatMinutes = (minutes: number) =>
    Duration.fromSeconds(minutes * 60).toString();
</script>

<StatsCard
  class="bg-linear-to-br from-rose-500/10 to-orange-500/10 border-rose-400/40 px-5 py-4 dark:border-rose-500/20"
>
  <div class="mb-2 flex items-center gap-2">
    <Gauge size={18} class="text-rose-500" />
    <h3 class="text-base font-semibold">Punctuality</h3>
    <HelpTooltip
      text="Based on arrival vs. scheduled arrival. A flight counts as delayed when it lands more than {DELAY_THRESHOLD_MINUTES} minutes late."
    />
  </div>

  {#if report.assessedFlights === 0}
    <p class="py-6 text-sm text-muted-foreground">
      No punctuality data yet — add scheduled and actual arrival times to your
      flights to see delay statistics here.
    </p>
  {:else}
    <div class="divide-y divide-border/60">
      <div class="flex items-center justify-between gap-4 py-2.5">
        <span class="text-sm text-muted-foreground">Delayed flights</span>
        <div class="text-right">
          <div class="text-lg font-bold text-foreground">
            <NumberFlow
              value={report.delayRate}
              format={{ maximumFractionDigits: 1 }}
            />%
          </div>
          <div class="text-xs text-muted-foreground">
            <NumberFlow value={report.delayedFlights} /> of
            <NumberFlow value={report.assessedFlights} /> assessed
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-4 py-2.5">
        <span class="text-sm text-muted-foreground">Total time lost</span>
        <span class="text-sm font-semibold text-foreground">
          {report.totalDelayMinutes > 0
            ? formatMinutes(report.totalDelayMinutes)
            : '—'}
        </span>
      </div>

      <div class="flex items-center justify-between gap-4 py-2.5">
        <span class="text-sm text-muted-foreground">Worst delay</span>
        <span class="text-sm font-semibold text-foreground">
          {report.worstDelayMinutes > 0
            ? formatMinutes(report.worstDelayMinutes)
            : '—'}
        </span>
      </div>

      {#if report.worstAirlines.length > 0}
        <div class="space-y-2 py-2.5">
          <span class="text-sm text-muted-foreground"
            >Most delays by airline</span
          >
          {#each report.worstAirlines as airline, idx (airline.airline)}
            <div class="flex items-center justify-between gap-4">
              <div class="flex min-w-0 items-center gap-2">
                <span class="text-xs font-medium text-muted-foreground">
                  #{idx + 1}
                </span>
                <span class="truncate text-sm text-foreground">
                  {airline.airline}
                </span>
              </div>
              <div class="text-right">
                <div class="text-xs font-semibold text-foreground">
                  {formatMinutes(airline.totalDelayMinutes)}
                </div>
                <div class="text-xs text-muted-foreground">
                  <NumberFlow
                    value={airline.delayRate}
                    format={{ maximumFractionDigits: 1 }}
                  />% delayed
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="flex items-center gap-2 py-2.5 text-sm text-muted-foreground"
        >
          <CircleCheck size={16} class="text-emerald-500" />
          Every assessed flight arrived on time.
        </div>
      {/if}
    </div>
  {/if}
</StatsCard>
