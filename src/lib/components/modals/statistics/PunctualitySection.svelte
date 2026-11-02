<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { CHART_NOUNS, createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';
  import DelayedFlightRow from './DelayedFlightRow.svelte';

  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
    type PunctualityEntry,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';

  let {
    flights,
    onOpenPunctuality,
    onOpenAllDelayed,
    onOpenFlight,
  }: {
    flights: FlightData[];
    /** Opens the punctuality dock; the dock itself toggles total/average. */
    onOpenPunctuality: (
      key: 'airlines' | 'routes' | 'departure-airports',
      entry?: string,
    ) => void;
    onOpenAllDelayed: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const DISPLAY_LIMIT = 3;

  const report = $derived(punctualityReport(flights));
  // Built once per chart, not per row
  const detailsFor = $derived.by(() => ({
    airlines: createDetailsLookup('airlines', flights),
    routes: createDetailsLookup('routes', flights),
    'departure-airports': createDetailsLookup('departure-airports', flights),
  }));

  const duration = (minutes: number) =>
    Duration.fromSeconds(minutes * 60).toString(true);
  // Late is +, early is −, the way delays are usually spoken about
  const signed = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${duration(Math.abs(minutes))}`;
</script>

{#snippet groupList(
  title: string,
  chartKey: 'airlines' | 'routes' | 'departure-airports',
  entries: PunctualityEntry[],
)}
  <div class="min-w-0">
    <h4 class="mb-1.5 text-[13px] font-semibold">{title}</h4>
    <div class="space-y-0.5">
      {#each entries.slice(0, DISPLAY_LIMIT) as entry (entry.key)}
        <BreakdownRow
          share={entry.totalDelayMinutes / (entries[0]?.totalDelayMinutes || 1)}
          value={signed(entry.totalDelayMinutes)}
          onclick={() => onOpenPunctuality(chartKey, entry.key)}
        >
          <BreakdownLabel
            {chartKey}
            entryKey={entry.key}
            details={detailsFor[chartKey](entry.key)}
          />
        </BreakdownRow>
      {/each}
    </div>
    {#if entries.length > DISPLAY_LIMIT}
      <button
        type="button"
        class="mt-1 flex items-center gap-0.5 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        onclick={() => onOpenPunctuality(chartKey)}
      >
        All {entries.length}
        {CHART_NOUNS[chartKey][1]}
        <ChevronRight size={13} />
      </button>
    {/if}
  </div>
{/snippet}

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
      <div class="text-[13px] text-muted-foreground">
        {report.delayedFlights}
        {pluralize(report.delayedFlights, 'flight')} late
        {#if report.worstDelayMinutes > 0}
          · worst {signed(report.worstDelayMinutes)}
        {/if}
      </div>
    </div>
    <div>
      <div class="text-[13px] text-muted-foreground">Ahead of schedule</div>
      <div class="text-[26px] font-bold tracking-tight">
        {report.earlyFlights > 0 ? duration(report.totalEarlyMinutes) : '0m'}
      </div>
      {#if report.earlyFlights > 0}
        <div class="text-[13px] text-muted-foreground">
          {report.earlyFlights}
          {pluralize(report.earlyFlights, 'flight')} early · best −{duration(
            report.bestEarlyMinutes,
          )}
        </div>
      {/if}
    </div>
  </div>

  <!-- Two columns, so the flight list has room for its five rows -->
  <div class="mt-6 grid grid-cols-1 gap-x-7 gap-y-6 sm:grid-cols-2">
    {@render groupList('Delays by airline', 'airlines', report.worstAirlines)}
    {@render groupList('Delays by route', 'routes', report.worstRoutes)}
    {@render groupList(
      'Delays by departing airport',
      'departure-airports',
      report.worstDepartureAirports,
    )}
    <div class="min-w-0">
      <h4 class="mb-1.5 text-[13px] font-semibold">Most delayed flights</h4>
      {#if report.worstDelays.length}
        <div class="space-y-0.5">
          {#each report.worstDelays as delay (delay.flight.id)}
            <DelayedFlightRow
              {delay}
              largest={report.worstDelays[0]?.delayMinutes || 1}
              onclick={() => onOpenFlight?.(delay.flight.id)}
            />
          {/each}
        </div>
        {#if report.delayedFlights > report.worstDelays.length}
          <button
            type="button"
            class="mt-1 flex items-center gap-0.5 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            onclick={onOpenAllDelayed}
          >
            All {report.delayedFlights} delayed
            {pluralize(report.delayedFlights, 'flight', 'flights')}
            <ChevronRight size={13} />
          </button>
        {/if}
      {:else}
        <p class="px-2 text-sm text-muted-foreground">
          Every assessed flight arrived on time.
        </p>
      {/if}
    </div>
  </div>
{/if}
