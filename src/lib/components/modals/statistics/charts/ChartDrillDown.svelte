<script lang="ts">
  import { sortByDepartureDesc } from '../../list-flights/flight-list-groups';
  import { CHART_NOUNS, createDetailsLookup } from '../breakdown';
  import BreakdownLabel from '../BreakdownLabel.svelte';
  import BreakdownRow from '../BreakdownRow.svelte';
  import DrillDownFlights from '../DrillDownFlights.svelte';
  import DrillDownSheet from '../DrillDownSheet.svelte';

  import { page } from '$app/state';
  import { Input } from '$lib/components/ui/input';
  import * as Tabs from '$lib/components/ui/tabs';
  import {
    FLIGHT_CHARTS,
    flightMatchesChartBucket,
    toBreakdown,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import { pluralize, type FlightData } from '$lib/utils';
  import { formatDistance, getPreferences } from '$lib/utils/preferences';

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

  const prefs = $derived(getPreferences(page.data.user));
  const breakdown = $derived(
    toBreakdown(
      FLIGHT_CHARTS[chartKey].aggregate(flights, { userId: seatUserId }),
    ),
  );
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

  const newestFirst = $derived(sortByDepartureDesc(flights));
  const flightsFor = (key: string) =>
    newestFirst.filter((flight) =>
      flightMatchesChartBucket(flight, chartKey, key, { userId: seatUserId }),
    );

  // Rows rank by flights, or by the distance those flights covered, so a
  // single long-haul trip can outrank a commute flown many times.
  let metric = $state<'flights' | 'distance'>('flights');
  const amounts = $derived(
    new Map(
      [...breakdown.entries, { key: 'No Data', value: breakdown.missing }].map(
        ({ key, value }) => [
          key,
          metric === 'distance'
            ? flightsFor(key).reduce((sum, f) => sum + (f.distance ?? 0), 0)
            : value,
        ],
      ),
    ),
  );
  const amountOf = (key: string) => amounts.get(key) ?? 0;
  const formatAmount = (key: string) =>
    metric === 'distance'
      ? formatDistance(amountOf(key), prefs)
      : amountOf(key);

  const rankedEntries = $derived(
    metric === 'distance'
      ? [...breakdown.entries].sort((a, b) => amountOf(b.key) - amountOf(a.key))
      : breakdown.entries,
  );
  // Rows share the bar scale of the top one. A list with no distances at all
  // divides by zero, which BreakdownRow draws as no bar.
  const largest = $derived(amountOf(rankedEntries[0]?.key ?? ''));

  let query = $state('');
  let expandedKey = $derived<string | null>(initialEntry ?? null);
  let fullyExpanded: string[] = $state([]);

  const visibleEntries = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rankedEntries;
    return rankedEntries.filter(
      ({ key }) =>
        key.toLowerCase().includes(needle) ||
        detailsFor(key).description?.toLowerCase().includes(needle) ||
        detailsFor(key).subtitle?.toLowerCase().includes(needle),
    );
  });
</script>

<DrillDownSheet title={FLIGHT_CHARTS[chartKey].title} {subtitle} {onBack}>
  <div class="mb-2 flex items-center justify-end gap-2">
    {#if breakdown.entries.length > SEARCH_THRESHOLD}
      <Input
        bind:value={query}
        placeholder="Search {CHART_NOUNS[chartKey][1]}"
        class="h-9 min-w-0 flex-1"
      />
    {/if}
    <Tabs.Root
      value={metric}
      onValueChange={(value) => {
        if (value === 'flights' || value === 'distance') metric = value;
      }}
    >
      <Tabs.List class="h-9">
        <Tabs.Trigger value="flights">Flights</Tabs.Trigger>
        <Tabs.Trigger value="distance">Distance</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </div>
  <div class="space-y-0.5">
    {#each visibleEntries as { key } (key)}
      <BreakdownRow
        share={amountOf(key) / largest}
        value={formatAmount(key)}
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
        value={formatAmount('No Data')}
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
