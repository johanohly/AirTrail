<script lang="ts">
  import FlightCard from '../../list-flights/FlightCard.svelte';
  import { CHART_NOUNS, createDetailsLookup } from '../breakdown';
  import BreakdownLabel from '../BreakdownLabel.svelte';
  import BreakdownRow from '../BreakdownRow.svelte';
  import DrillDownSheet from '../DrillDownSheet.svelte';

  import { Input } from '$lib/components/ui/input';
  import {
    FLIGHT_CHARTS,
    flightMatchesChartBucket,
    toBreakdown,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';

  const FLIGHT_PREVIEW_LIMIT = 5;
  const SEARCH_THRESHOLD = 8;

  let {
    chartKey,
    initialEntry,
    flights,
    onBack,
    onOpenFlight,
    seatUserId,
  }: {
    chartKey: FlightChartKey;
    initialEntry?: string | null;
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
    seatUserId?: string;
  } = $props();

  const breakdown = $derived(
    toBreakdown(
      FLIGHT_CHARTS[chartKey].aggregate(flights, { userId: seatUserId }),
    ),
  );
  const largest = $derived(breakdown.entries[0]?.value ?? 0);
  const detailsFor = $derived(createDetailsLookup(chartKey, flights));
  const subtitle = $derived.by(() => {
    const count = breakdown.entries.length;
    const [one, many] = CHART_NOUNS[chartKey];
    const summary = `${count} ${count === 1 ? one : many} across ${flights.length} ${pluralize(flights.length, 'flight')}.`;
    return chartKey === 'routes'
      ? `${summary} Return legs count as one route.`
      : summary;
  });

  let query = $state('');
  let expandedKey = $derived<string | null>(initialEntry ?? null);
  let fullyExpanded: string[] = $state([]);

  const visibleEntries = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return breakdown.entries;
    return breakdown.entries.filter(
      ({ key }) =>
        key.toLowerCase().includes(needle) ||
        detailsFor(key).description?.toLowerCase().includes(needle) ||
        detailsFor(key).subtitle?.toLowerCase().includes(needle),
    );
  });

  const flightsFor = (key: string) =>
    flights.filter((flight) =>
      flightMatchesChartBucket(flight, chartKey, key, { userId: seatUserId }),
    );
</script>

{#snippet expansion(key: string)}
  {@const matching = flightsFor(key)}
  {@const visible = fullyExpanded.includes(key)
    ? matching
    : matching.slice(0, FLIGHT_PREVIEW_LIMIT)}
  {@const hidden = matching.length - visible.length}
  <div class="mb-2 ml-2 mt-1 border-l pl-3">
    {#each visible as flight (flight.id)}
      {#if onOpenFlight}
        <button
          type="button"
          class="w-full rounded px-1 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
          onclick={() => onOpenFlight(flight.id)}
        >
          <FlightCard {flight} compact />
        </button>
      {:else}
        <div class="px-1 py-2"><FlightCard {flight} compact /></div>
      {/if}
    {/each}
    {#if hidden > 0}
      <button
        type="button"
        class="rounded px-1 py-1.5 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        onclick={() => (fullyExpanded = [...fullyExpanded, key])}
      >
        Show {hidden} more {pluralize(hidden, 'flight')}
      </button>
    {/if}
  </div>
{/snippet}

<DrillDownSheet title={FLIGHT_CHARTS[chartKey].title} {subtitle} {onBack}>
  {#if breakdown.entries.length > SEARCH_THRESHOLD}
    <Input
      bind:value={query}
      placeholder="Search {CHART_NOUNS[chartKey][1]}"
      class="mb-2 h-9"
    />
  {/if}
  <div class="space-y-0.5">
    {#each visibleEntries as { key, value } (key)}
      <BreakdownRow
        share={value / largest}
        {value}
        expanded={expandedKey === key}
        onclick={() => (expandedKey = expandedKey === key ? null : key)}
      >
        <BreakdownLabel {chartKey} entryKey={key} details={detailsFor(key)} />
      </BreakdownRow>
      {#if expandedKey === key}
        {@render expansion(key)}
      {/if}
    {:else}
      <p class="py-3 text-sm text-muted-foreground">No matches</p>
    {/each}
    {#if breakdown.missing > 0 && !query.trim()}
      <BreakdownRow
        value={breakdown.missing}
        expanded={expandedKey === 'No Data'}
        onclick={() =>
          (expandedKey = expandedKey === 'No Data' ? null : 'No Data')}
      >
        <span class="text-muted-foreground">Not recorded</span>
      </BreakdownRow>
      {#if expandedKey === 'No Data'}
        {@render expansion('No Data')}
      {/if}
    {/if}
  </div>
</DrillDownSheet>
