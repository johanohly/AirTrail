<script lang="ts">
  import FlightCard from '../../list-flights/FlightCard.svelte';
  import { CHART_NOUNS, createDetailsLookup } from '../breakdown';
  import BreakdownLabel from '../BreakdownLabel.svelte';
  import BreakdownRow from '../BreakdownRow.svelte';
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
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

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
  const detailsFor = $derived(createDetailsLookup(chartKey, flights));
  const subtitle = $derived.by(() => {
    const count = breakdown.entries.length;
    const [one, many] = CHART_NOUNS[chartKey];
    const summary = `${count} ${count === 1 ? one : many} across ${flights.length} ${pluralize(flights.length, 'flight')}.`;
    return chartKey === 'routes'
      ? `${summary} Return legs count as one route.`
      : summary;
  });

  /* Rows can be ranked by flight count or by the distance those flights
     covered, the way Flightradar24's lists switch. */
  type Metric = 'flights' | 'distance';
  let metric = $state<Metric>('flights');

  const prefs = $derived(getPreferences(page.data.user));

  const flightsFor = (key: string) =>
    flights.filter((flight) =>
      flightMatchesChartBucket(flight, chartKey, key, { userId: seatUserId }),
    );

  const distancesByKey = $derived.by(() => {
    const map = new Map<string, number>();
    for (const { key } of breakdown.entries) {
      map.set(
        key,
        flightsFor(key).reduce((sum, f) => sum + (f.distance ?? 0), 0),
      );
    }
    return map;
  });

  const metricValueOf = (key: string) =>
    metric === 'distance' ? (distancesByKey.get(key) ?? 0) : null;

  const rankedEntries = $derived(
    metric === 'distance'
      ? [...breakdown.entries].sort(
          (a, b) =>
            (distancesByKey.get(b.key) ?? 0) - (distancesByKey.get(a.key) ?? 0),
        )
      : breakdown.entries,
  );
  const largest = $derived(
    metric === 'distance'
      ? Math.max(...distancesByKey.values(), 0)
      : (breakdown.entries[0]?.value ?? 0),
  );

  const missingDistance = $derived(
    breakdown.missing > 0
      ? flightsFor('No Data').reduce((sum, f) => sum + (f.distance ?? 0), 0)
      : 0,
  );

  const formatKm = (km: number) =>
    `${Math.round(convertDistance(km, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}`;

  const formatMetric = (key: string, count: number) =>
    metric === 'distance' ? formatKm(distancesByKey.get(key) ?? 0) : count;

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
  <div class="mb-2 flex items-center gap-2">
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
    {#each visibleEntries as { key, value } (key)}
      {@const metricValue = metricValueOf(key) ?? value}
      <BreakdownRow
        share={metricValue / largest}
        value={formatMetric(key, value)}
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
        value={metric === 'distance'
          ? formatKm(missingDistance)
          : breakdown.missing}
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
