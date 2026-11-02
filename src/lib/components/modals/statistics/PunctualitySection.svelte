<script lang="ts">
  import { createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';

  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
    routeLabelForFlight,
    type FlightChartKey,
    type FlightDelay,
    type PunctualityEntry,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';

  let {
    flights,
    onOpen,
    onOpenFlight,
  }: {
    flights: FlightData[];
    onOpen: (key: FlightChartKey, entry?: string) => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const report = $derived(punctualityReport(flights));
  // Built once per chart, not per row
  const detailsFor = $derived.by(() => ({
    airlines: createDetailsLookup('airlines', flights),
    routes: createDetailsLookup('routes', flights),
    airports: createDetailsLookup('airports', flights),
  }));

  const duration = (minutes: number) =>
    Duration.fromSeconds(minutes * 60).toString(true);
  // Late is +, early is −, the way delays are usually spoken about
  const signed = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${duration(Math.abs(minutes))}`;

  const hasGroups = $derived(
    report.worstAirlines.length > 0 ||
      report.worstRoutes.length > 0 ||
      report.worstDepartureAirports.length > 0,
  );
</script>

{#snippet groupList(
  title: string,
  chartKey: 'airlines' | 'routes' | 'airports',
  entries: PunctualityEntry[],
)}
  <div class="min-w-0">
    <h4 class="mb-1.5 text-[13px] font-semibold">{title}</h4>
    <div class="space-y-0.5">
      {#each entries as entry (entry.key)}
        <BreakdownRow
          share={entry.totalDelayMinutes / (entries[0]?.totalDelayMinutes ?? 1)}
          value={signed(entry.totalDelayMinutes)}
          onclick={() =>
            onOpen(
              chartKey,
              entry.key === 'Unknown airline' ? 'No Data' : entry.key,
            )}
        >
          <BreakdownLabel
            {chartKey}
            entryKey={entry.key}
            details={detailsFor[chartKey](entry.key)}
          />
        </BreakdownRow>
      {/each}
    </div>
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
      {#if report.worstDelayMinutes > 0}
        <div class="text-[13px] text-muted-foreground">
          Worst {signed(report.worstDelayMinutes)}
        </div>
      {/if}
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

  <div
    class="mt-6 grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4"
  >
    {#if hasGroups}
      {@render groupList('Delays by airline', 'airlines', report.worstAirlines)}
      {@render groupList('Delays by route', 'routes', report.worstRoutes)}
      {@render groupList(
        'Delays by departing airport',
        'airports',
        report.worstDepartureAirports,
      )}
    {:else}
      <p class="text-sm text-muted-foreground">
        Every assessed flight arrived on time.
      </p>
    {/if}
    <div class="min-w-0">
      <h4 class="mb-1.5 text-[13px] font-semibold">Most delayed flights</h4>
      {#if report.worstDelays.length}
        <div class="space-y-0.5">
          {#each report.worstDelays as delay (delay.flight.id)}
            {@const key = routeLabelForFlight(delay.flight) ?? ''}
            <BreakdownRow
              share={delay.delayMinutes /
                (report.worstDelays[0]?.delayMinutes || 1)}
              value={signed(delay.delayMinutes)}
              onclick={() => onOpenFlight?.(delay.flight.id)}
            >
              <BreakdownLabel
                chartKey="routes"
                entryKey={key}
                details={detailsFor.routes(key)}
              />
            </BreakdownRow>
          {/each}
        </div>
      {:else}
        <p class="px-2 text-sm text-muted-foreground">Nothing assessed.</p>
      {/if}
    </div>
  </div>
{/if}
