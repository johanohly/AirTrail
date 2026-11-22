<script lang="ts">
  import { createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';
  import DelayedFlightRow from './DelayedFlightRow.svelte';
  import ShowAllButton from './ShowAllButton.svelte';

  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import {
    DELAY_THRESHOLD_MINUTES,
    formatDelay,
    formatSignedDelay,
    PUNCTUALITY_GROUPS,
    punctualityReport,
    type PunctualityGroupKey,
  } from '$lib/stats/punctuality';
  import { pluralize, type FlightData } from '$lib/utils';
  import { round } from '$lib/utils/number';

  let {
    flights,
    onOpenGroup,
    onOpenDelayedFlights,
    onOpenFlight,
  }: {
    flights: FlightData[];
    onOpenGroup: (group: PunctualityGroupKey, entry?: string) => void;
    onOpenDelayedFlights: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const DISPLAY_LIMIT = 3;

  const report = $derived(punctualityReport(flights));
</script>

{#snippet groupList(group: PunctualityGroupKey)}
  {@const { noun, plural, labelKey } = PUNCTUALITY_GROUPS[group]}
  {@const entries = report.groups[group]}
  {@const detailsFor = createDetailsLookup(labelKey, flights)}
  <div class="min-w-0">
    <h4 class="mb-1.5 text-[13px] font-semibold">Delays by {noun}</h4>
    <div class="space-y-0.5">
      {#each entries.slice(0, DISPLAY_LIMIT) as entry (entry.key)}
        <BreakdownRow
          share={entry.totalDelayMinutes / entries[0]!.totalDelayMinutes}
          value={formatSignedDelay(entry.totalDelayMinutes)}
          onclick={() => onOpenGroup(group, entry.key)}
        >
          <BreakdownLabel
            chartKey={labelKey}
            entryKey={entry.key}
            details={detailsFor(entry.key)}
          />
        </BreakdownRow>
      {/each}
    </div>
    {#if entries.length > DISPLAY_LIMIT}
      <ShowAllButton onclick={() => onOpenGroup(group)}>
        All {entries.length}
        {plural}
      </ShowAllButton>
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
        {formatDelay(report.totalDelayMinutes)}
      </div>
      {#if report.worstDelayMinutes > 0}
        <div class="text-[13px] text-muted-foreground">
          Worst delay {formatDelay(report.worstDelayMinutes)}
        </div>
      {/if}
    </div>
    <div>
      <div class="text-[13px] text-muted-foreground">Ahead of schedule</div>
      <div class="text-[26px] font-bold tracking-tight">
        {formatDelay(report.totalEarlyMinutes)}
      </div>
      {#if report.earlyFlights > 0}
        <div class="text-[13px] text-muted-foreground">
          {report.earlyFlights}
          {pluralize(report.earlyFlights, 'flight')} early, best {formatDelay(
            report.bestEarlyMinutes,
          )}
        </div>
      {/if}
    </div>
  </div>

  {#if report.delayedFlights === 0}
    <p class="mt-6 text-sm text-muted-foreground">
      Every assessed flight arrived on time.
    </p>
  {:else}
    <div class="mt-6 grid gap-x-7 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
      {@render groupList('airlines')}
      {@render groupList('routes')}
      {@render groupList('departure-airports')}
      <div class="min-w-0">
        <h4 class="mb-1.5 text-[13px] font-semibold">Most delayed flights</h4>
        <div class="space-y-0.5">
          {#each report.delays.slice(0, DISPLAY_LIMIT) as delay (delay.flight.id)}
            <DelayedFlightRow
              {delay}
              largest={report.worstDelayMinutes}
              onclick={onOpenFlight && (() => onOpenFlight(delay.flight.id))}
            />
          {/each}
        </div>
        {#if report.delayedFlights > DISPLAY_LIMIT}
          <ShowAllButton onclick={onOpenDelayedFlights}>
            All {report.delayedFlights} delayed flights
          </ShowAllButton>
        {/if}
      </div>
    </div>
  {/if}
{/if}
