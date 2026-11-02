<script lang="ts">
  import FlightCard from '../list-flights/FlightCard.svelte';
  import { createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';
  import DrillDownSheet from './DrillDownSheet.svelte';

  import * as Tabs from '$lib/components/ui/tabs';

  import {
    arrivalDelayMinutes,
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
    routeLabelForFlight,
    type PunctualityEntry,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';

  const FLIGHT_PREVIEW_LIMIT = 5;

  const TITLES = {
    airlines: { noun: 'airline', many: 'airlines' },
    routes: { noun: 'route', many: 'routes' },
    'departure-airports': {
      noun: 'departing airport',
      many: 'departure airports',
    },
  } as const;

  let {
    chartKey,
    initialMode,
    initialEntry,
    flights,
    onBack,
    onOpenFlight,
  }: {
    chartKey: keyof typeof TITLES;
    /** The ranking the dock opens on; the in-dock toggle switches it. */
    initialMode?: 'total' | 'average';
    initialEntry?: string | null;
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  // total ranks by accumulated late minutes; average by mean difference
  type Mode = 'total' | 'average';
  let mode = $state<Mode>('total');
  $effect(() => {
    void chartKey;
    mode = initialMode ?? 'total';
  });

  const report = $derived(punctualityReport(flights));
  const entries = $derived<PunctualityEntry[]>(
    mode === 'average'
      ? chartKey === 'airlines'
        ? report.avgAirlines
        : chartKey === 'routes'
          ? report.avgRoutes
          : report.avgDepartureAirports
      : chartKey === 'airlines'
        ? report.worstAirlines
        : chartKey === 'routes'
          ? report.worstRoutes
          : report.worstDepartureAirports,
  );
  const detailsFor = $derived(createDetailsLookup(chartKey, flights));

  const title = $derived(
    `${mode === 'average' ? 'Avg delay' : 'Delays'} by ${TITLES[chartKey].noun}`,
  );
  const subtitle = $derived(
    mode === 'average'
      ? `${entries.length} ${TITLES[chartKey].many} with delayed flights. Average minutes late per delayed flight.`
      : `${entries.length} ${TITLES[chartKey].many} across ${report.assessedFlights} assessed ${pluralize(report.assessedFlights, 'flight')}. Minutes past the ${DELAY_THRESHOLD_MINUTES}-minute threshold.`,
  );

  const valueOf = (entry: PunctualityEntry) =>
    mode === 'average'
      ? Math.round(entry.averageDelayMinutes)
      : entry.totalDelayMinutes;

  const duration = (minutes: number) =>
    Duration.fromSeconds(Math.abs(minutes) * 60).toString(true);
  // Late is +, early is −, the way delays are usually spoken about
  const signed = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${duration(minutes)}`;

  // The flights inside a row read worst-first
  const byDelayDesc = (list: FlightData[]) =>
    [...list].sort(
      (a, b) =>
        (arrivalDelayMinutes(b) ?? Number.NEGATIVE_INFINITY) -
        (arrivalDelayMinutes(a) ?? Number.NEGATIVE_INFINITY),
    );

  let expandedKey = $derived<string | null>(initialEntry ?? null);
  let fullyExpanded: string[] = $state([]);
</script>

{#snippet expansion(entry: PunctualityEntry)}
  {@const matching = byDelayDesc(
    flights.filter((flight) =>
      chartKey === 'airlines'
        ? (flight.airline?.name ?? 'Unknown airline') === entry.key
        : chartKey === 'routes'
          ? routeLabelForFlight(flight) === entry.key
          : (flight.from?.iata || flight.from?.icao) === entry.key,
    ),
  )}
  {@const visible = fullyExpanded.includes(entry.key)
    ? matching
    : matching.slice(0, FLIGHT_PREVIEW_LIMIT)}
  {@const hidden = matching.length - visible.length}
  <div class="mb-2 ml-2 mt-1 border-l pl-3">
    {#each visible as flight (flight.id)}
      {@const delay = arrivalDelayMinutes(flight)}
      <!-- The card stays full width: squeezing it beside the delay hides
           its flags, which only render from 416px of card width -->
      {#if onOpenFlight}
        <button
          type="button"
          class="w-full rounded px-1 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
          onclick={() => onOpenFlight(flight.id)}
        >
          <FlightCard {flight} compact />
          {#if delay !== null}
            <div
              class="-mt-1 pr-1 text-right text-[13px] font-medium tabular-nums text-muted-foreground"
            >
              {signed(Math.round(delay))}
            </div>
          {/if}
        </button>
      {:else}
        <div class="px-1 py-2">
          <FlightCard {flight} compact />
          {#if delay !== null}
            <div
              class="-mt-1 pr-1 text-right text-[13px] font-medium tabular-nums text-muted-foreground"
            >
              {signed(Math.round(delay))}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
    {#if hidden > 0}
      <button
        type="button"
        class="rounded px-1 py-1.5 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        onclick={() => (fullyExpanded = [...fullyExpanded, entry.key])}
      >
        Show {hidden} more {pluralize(hidden, 'flight')}
      </button>
    {/if}
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
        share={valueOf(entry) / (valueOf(entries[0]!) || 1)}
        value={signed(valueOf(entry))}
        expanded={expandedKey === entry.key}
        onclick={() =>
          (expandedKey = expandedKey === entry.key ? null : entry.key)}
      >
        <BreakdownLabel
          {chartKey}
          entryKey={entry.key}
          details={detailsFor(entry.key)}
        />
      </BreakdownRow>
      {#if expandedKey === entry.key}
        {@render expansion(entry)}
      {/if}
    {:else}
      <p class="py-3 text-sm text-muted-foreground">
        Every assessed flight arrived on time.
      </p>
    {/each}
  </div>
</DrillDownSheet>
