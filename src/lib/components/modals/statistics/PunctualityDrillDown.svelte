<script lang="ts">
  import { sortByDepartureDesc } from '../list-flights/flight-list-groups';
  import { createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';
  import DrillDownFlights from './DrillDownFlights.svelte';
  import DrillDownSheet from './DrillDownSheet.svelte';

  import * as Tabs from '$lib/components/ui/tabs';
  import {
    arrivalDelayMinutes,
    byAverageDelay,
    DELAY_THRESHOLD_MINUTES,
    formatSignedDelay,
    PUNCTUALITY_GROUPS,
    punctualityReport,
    type PunctualityEntry,
    type PunctualityGroupKey,
  } from '$lib/stats/punctuality';
  import { pluralize, type FlightData } from '$lib/utils';

  let {
    group,
    initialEntry,
    flights,
    onBack,
    onOpenFlight,
  }: {
    group: PunctualityGroupKey;
    initialEntry?: string | null;
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const { noun, plural, labelKey, keyOf } = $derived(PUNCTUALITY_GROUPS[group]);

  // Total ranks by minutes lost, average by minutes per delayed flight.
  let mode = $state<'total' | 'average'>('total');

  const report = $derived(punctualityReport(flights));
  const entries = $derived(
    mode === 'average'
      ? byAverageDelay(report.groups[group])
      : report.groups[group],
  );
  const detailsFor = $derived(createDetailsLookup(labelKey, flights));

  const title = $derived(
    `${mode === 'average' ? 'Average delay' : 'Delays'} by ${noun}`,
  );
  const subtitle = $derived(
    mode === 'average'
      ? `${entries.length} ${plural} with delayed flights. Average minutes late per delayed flight.`
      : `${entries.length} ${plural} across ${report.assessedFlights} assessed ${pluralize(report.assessedFlights, 'flight')}. Time lost on flights that landed more than ${DELAY_THRESHOLD_MINUTES} minutes late.`,
  );

  const amountOf = (entry: PunctualityEntry) =>
    mode === 'average' ? entry.averageDelayMinutes : entry.totalDelayMinutes;

  const delays = $derived(
    new Map(flights.map((flight) => [flight.id, arrivalDelayMinutes(flight)])),
  );
  const newestFirst = $derived(sortByDepartureDesc(flights));
  /** The group's assessed flights, worst delay first, then newest first. */
  const flightsIn = (key: string) =>
    newestFirst
      .filter(
        (flight) => delays.get(flight.id) != null && keyOf(flight) === key,
      )
      .sort((a, b) => delays.get(b.id)! - delays.get(a.id)!);

  let expandedKey = $derived<string | null>(initialEntry ?? null);
  let fullyExpanded: string[] = $state([]);
</script>

{#snippet delayOf(flight: FlightData)}
  <div
    class="-mt-1 pr-1 text-right text-[13px] font-medium tabular-nums text-muted-foreground"
  >
    {formatSignedDelay(delays.get(flight.id)!)}
  </div>
{/snippet}

<DrillDownSheet {title} {subtitle} {onBack}>
  <div class="mb-2 flex justify-end">
    <Tabs.Root
      value={mode}
      onValueChange={(value) => {
        if (value === 'total' || value === 'average') mode = value;
      }}
    >
      <Tabs.List class="h-9">
        <Tabs.Trigger value="total">Total</Tabs.Trigger>
        <Tabs.Trigger value="average">Average</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </div>
  <div class="space-y-0.5">
    {#each entries as entry (entry.key)}
      <BreakdownRow
        share={amountOf(entry) / amountOf(entries[0]!)}
        value={formatSignedDelay(amountOf(entry))}
        expanded={expandedKey === entry.key}
        onclick={() =>
          (expandedKey = expandedKey === entry.key ? null : entry.key)}
      >
        <BreakdownLabel
          chartKey={labelKey}
          entryKey={entry.key}
          details={detailsFor(entry.key)}
        />
      </BreakdownRow>
      {#if expandedKey === entry.key}
        <DrillDownFlights
          flights={flightsIn(entry.key)}
          showAll={fullyExpanded.includes(entry.key)}
          onShowAll={() => (fullyExpanded = [...fullyExpanded, entry.key])}
          {onOpenFlight}
          below={delayOf}
        />
      {/if}
    {:else}
      <p class="py-3 text-sm text-muted-foreground">No delayed flights</p>
    {/each}
  </div>
</DrillDownSheet>
