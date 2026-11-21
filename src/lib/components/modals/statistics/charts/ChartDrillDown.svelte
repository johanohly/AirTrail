<script lang="ts">
  import { sortByDepartureDesc } from '../../list-flights/flight-list-groups';
  import { CHART_NOUNS, createDetailsLookup } from '../breakdown';
  import BreakdownLabel from '../BreakdownLabel.svelte';
  import BreakdownRow from '../BreakdownRow.svelte';
  import DrillDownFlights from '../DrillDownFlights.svelte';
  import DrillDownSheet from '../DrillDownSheet.svelte';

  import { Input } from '$lib/components/ui/input';
  import {
    FLIGHT_CHARTS,
    flightMatchesChartBucket,
    toBreakdown,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';

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
  const detailsFor = $derived(
    createDetailsLookup(chartKey, flights, { userId: seatUserId }),
  );
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

  const newestFirst = $derived(sortByDepartureDesc(flights));
  const flightsFor = (key: string) =>
    newestFirst.filter((flight) =>
      flightMatchesChartBucket(flight, chartKey, key, { userId: seatUserId }),
    );
</script>

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
        <DrillDownFlights
          flights={flightsFor(key)}
          showAll={fullyExpanded.includes(key)}
          onShowAll={() => (fullyExpanded = [...fullyExpanded, key])}
          {onOpenFlight}
        />
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
        <DrillDownFlights
          flights={flightsFor('No Data')}
          showAll={fullyExpanded.includes('No Data')}
          onShowAll={() => (fullyExpanded = [...fullyExpanded, 'No Data'])}
          {onOpenFlight}
        />
      {/if}
    {/if}
  </div>
</DrillDownSheet>
