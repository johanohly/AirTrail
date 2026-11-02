<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { CHART_NOUNS, createDetailsLookup } from './breakdown';
  import BreakdownLabel from './BreakdownLabel.svelte';
  import BreakdownRow from './BreakdownRow.svelte';

  import { page } from '$app/state';
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
  import { formatDate, getPreferences } from '$lib/utils/preferences';

  let {
    flights,
    onOpen,
    onOpenFlight,
    onOpenAirport,
  }: {
    flights: FlightData[];
    onOpen: (key: FlightChartKey, entry?: string) => void;
    onOpenFlight?: (flightId: number) => void;
    onOpenAirport?: (airportId: number) => void;
  } = $props();

  const DISPLAY_LIMIT = 3;

  const report = $derived(punctualityReport(flights));
  const prefs = $derived(getPreferences(page.data.user));
  // Built once per chart, not per row
  const detailsFor = $derived.by(() => ({
    airlines: createDetailsLookup('airlines', flights),
    routes: createDetailsLookup('routes', flights),
    airports: createDetailsLookup('airports', flights),
  }));
  // Departure airport codes to their ids, for the dedicated airport view
  const airportIdFor = $derived.by(() => {
    const ids = new Map<string, number>();
    for (const flight of flights) {
      const code = flight.from?.iata || flight.from?.icao;
      if (code && flight.from && !ids.has(code)) ids.set(code, flight.from.id);
    }
    return ids;
  });

  const duration = (minutes: number) =>
    Duration.fromSeconds(minutes * 60).toString(true);
  // Late is +, early is −, the way delays are usually spoken about
  const signed = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${duration(Math.abs(minutes))}`;
</script>

{#snippet flag(country: string | null | undefined)}
  {#if country}
    <img
      src="https://flagcdn.com/{country.toLowerCase()}.svg"
      alt=""
      title={country.toUpperCase()}
      class="h-3 w-[18px] shrink-0 rounded-[2px] object-cover shadow-xs"
      loading="lazy"
      decoding="async"
    />
  {/if}
{/snippet}

{#snippet groupList(
  title: string,
  chartKey: 'airlines' | 'routes' | 'airports',
  entries: PunctualityEntry[],
)}
  <div class="min-w-0">
    <h4 class="mb-1.5 text-[13px] font-semibold">{title}</h4>
    <div class="space-y-0.5">
      {#each entries.slice(0, DISPLAY_LIMIT) as entry (entry.key)}
        <BreakdownRow
          share={entry.totalDelayMinutes / (entries[0]?.totalDelayMinutes ?? 1)}
          value={signed(entry.totalDelayMinutes)}
          onclick={() =>
            chartKey === 'airports' &&
            onOpenAirport &&
            airportIdFor.has(entry.key)
              ? onOpenAirport(airportIdFor.get(entry.key)!)
              : onOpen(
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
    {#if entries.length > DISPLAY_LIMIT}
      <button
        type="button"
        class="mt-1 flex items-center gap-0.5 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        onclick={() => onOpen(chartKey)}
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
  <div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
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
    <div>
      <div class="text-[13px] text-muted-foreground">Balance</div>
      <div class="text-[26px] font-bold tracking-tight">
        {signed(report.totalDelayMinutes - report.totalEarlyMinutes)}
      </div>
      <div class="truncate text-[13px] text-muted-foreground">
        {duration(report.totalDelayMinutes)} lost ·
        {duration(report.totalEarlyMinutes)} gained
      </div>
    </div>
  </div>

  <div
    class="mt-6 grid gap-x-7 gap-y-6 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4"
  >
    {@render groupList('Delays by airline', 'airlines', report.worstAirlines)}
    {@render groupList('Delays by route', 'routes', report.worstRoutes)}
    {@render groupList(
      'Delays by departing airport',
      'airports',
      report.worstDepartureAirports,
    )}
    <div class="min-w-0">
      <h4 class="mb-1.5 text-[13px] font-semibold">Most delayed flights</h4>
      {#if report.worstDelays.length}
        <div class="space-y-0.5">
          {#each report.worstDelays as delay (delay.flight.id)}
            <BreakdownRow
              share={delay.delayMinutes /
                (report.worstDelays[0]?.delayMinutes || 1)}
              value={signed(delay.delayMinutes)}
              onclick={() => onOpenFlight?.(delay.flight.id)}
            >
              {@render flag(delay.flight.from?.country)}
              {@render flag(delay.flight.to?.country)}
              <span class="min-w-0 shrink truncate font-semibold">
                {routeLabelForFlight(delay.flight) ?? 'Unknown flight'}
              </span>
              {#if delay.flight.date}
                <span class="min-w-0 truncate text-muted-foreground">
                  {formatDate(delay.flight.date, prefs, delay.flight.from?.tz)}
                </span>
              {/if}
            </BreakdownRow>
          {/each}
        </div>
      {:else}
        <p class="px-2 text-sm text-muted-foreground">Nothing assessed.</p>
      {/if}
    </div>
  </div>
{/if}
