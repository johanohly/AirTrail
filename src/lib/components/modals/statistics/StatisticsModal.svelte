<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { Plus } from '@o7/icon/lucide';

  import ChartDrillDown from './charts/ChartDrillDown.svelte';
  import ContinentDrillDown from './charts/ContinentDrillDown.svelte';
  import FlightsPerMonth from './charts/FlightsPerMonth.svelte';
  import FlightsPerWeekday from './charts/FlightsPerWeekday.svelte';
  import FlightsPerYear from './charts/FlightsPerYear.svelte';
  import BreakdownRow from './BreakdownRow.svelte';
  import PunctualitySection from './PunctualitySection.svelte';
  import RankedList from './RankedList.svelte';
  import SeatMap from './SeatMap.svelte';

  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import AdminScopeBanner from '$lib/components/admin/AdminScopeBanner.svelte';
  import {
    createDefaultFilters,
    hasFlightFilters,
    matchesFlight,
    perYearFilters,
    selectedFilterYears,
    toggleFilterYear,
  } from '$lib/components/flight-filters/model';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import { flightScopeState, openModalsState } from '$lib/state.svelte';
  import { Modal } from '$lib/components/ui/modal';
  import type { ModalHistoryHandle } from '$lib/components/ui/modal/modal-history';
  import ResponsiveFilters from '$lib/components/flight-filters/ResponsiveFilters.svelte';
  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import { type VisitedCountry, wasVisited } from '$lib/db/types';
  import {
    autopilotRatio,
    COUNTRY_BAR_CHARTS,
    COUNTRY_CHARTS,
    countriesByContinentDetails,
    domesticInternationalSplit,
    FLIGHT_CHARTS,
    flightTotals,
    type FlightChartKey,
    travelDayCount,
  } from '$lib/stats/aggregations';
  import {
    readIncludeUpcoming,
    writeIncludeUpcoming,
  } from '$lib/stats/upcoming-storage';
  import { pluralize, type FlightData } from '$lib/utils';
  import { isCompletedFlight } from '$lib/utils/data/flight-timeline';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  let {
    open = $bindable<boolean>(),
    flights,
    filteredFlights,
    filters = $bindable(),
    visitedCountries = [],
    showFilters = true,
    seatUserId,
    showCountryStats = true,
    onOpenFlight,
  }: {
    open?: boolean;
    flights: FlightData[];
    filteredFlights: FlightData[];
    filters: FlightFilters;
    visitedCountries?: VisitedCountry[];
    showFilters?: boolean;
    seatUserId?: string;
    showCountryStats?: boolean;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const showScopeBanner = $derived(flightScopeState.current.scope !== 'mine');

  let includeUpcoming = $state(readIncludeUpcoming());
  // Same rule as the flight list, so both agree on what is upcoming
  const completedFlights = $derived(
    filteredFlights.filter((f) => isCompletedFlight(f.raw)),
  );
  const upcomingCount = $derived(
    filteredFlights.length - completedFlights.length,
  );
  const countedFlights = $derived(
    includeUpcoming ? filteredFlights : completedFlights,
  );

  // Share pages have no filters, so there is nothing for a year to set.
  const canPickYear = $derived(showFilters);
  const selectedYears = $derived(
    canPickYear ? selectedFilterYears(filters).map(Number) : [],
  );
  const flightsPerYearSource = $derived.by(() => {
    if (!canPickYear) return countedFlights;
    const yearFilters = perYearFilters(filters);
    return flights.filter(
      (flight) =>
        matchesFlight(flight, yearFilters) &&
        (includeUpcoming || isCompletedFlight(flight.raw)),
    );
  });

  const prefs = $derived(getPreferences(page.data.user));

  const EARTH_CIRCUMFERENCE_KM = 40075;
  const MOON_DISTANCE_KM = 384400;
  const SUN_DISTANCE_KM = 149597870;

  let totalDuration = $derived.by(() =>
    Duration.fromSeconds(
      countedFlights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
    ),
  );
  let flightCount = $derived(countedFlights.length);
  let totalDistance = $derived(
    countedFlights.reduce((acc, curr) => (acc += curr.distance ?? 0), 0),
  );
  let totalDurationParts = $derived({
    days: totalDuration.days,
    hours: totalDuration.hours,
    minutes: totalDuration.minutes,
  });
  let airports = $derived(
    new Set(
      countedFlights
        .filter((f) => f.from && f.to)
        .flatMap((f) => [f.from!.name, f.to!.name]),
    ).size,
  );
  let countriesCount = $derived(
    visitedCountries.filter(
      (c) => c.status === 'visited' || c.status === 'lived',
    ).length,
  );
  let earthCircumnavigations = $derived(totalDistance / EARTH_CIRCUMFERENCE_KM);
  let moonTraversals = $derived(totalDistance / MOON_DISTANCE_KM);
  let sunTraversals = $derived(totalDistance / SUN_DISTANCE_KM);
  let travelDays = $derived(travelDayCount(countedFlights));
  let totals = $derived(flightTotals(countedFlights));
  let domesticSplit = $derived(domesticInternationalSplit(countedFlights));
  let durationWeeks = $derived(totalDuration.days / 7);
  let autopilot = $derived(
    autopilotRatio(countedFlights, { userId: seatUserId }),
  );

  let activeChart: FlightChartKey | null = $state(null);
  let activeEntry: string | null = $state(null);
  let activeContinent: string | null = $state(null);
  let modalHistory: ModalHistoryHandle | undefined = $state();
  let wasOpen = $state(false);
  const drillDownOpen = $derived(Boolean(activeChart || activeContinent));

  const countryStatus = $derived(
    COUNTRY_CHARTS['visited-country-status'].aggregate(visitedCountries),
  );
  const countriesByContinent = $derived(
    Object.entries(
      COUNTRY_BAR_CHARTS['countries-by-continent'].aggregate(visitedCountries),
    ).sort(([, a], [, b]) => b.visited - a.visited),
  );
  const countriesByContinentDetailsData = $derived(
    countriesByContinentDetails(visitedCountries),
  );

  const firstYear = $derived(
    countedFlights.reduce<number | null>((first, flight) => {
      const year = flight.date?.getFullYear();
      if (year == null || Number.isNaN(year)) return first;
      return first === null || year < first ? year : first;
    }, null),
  );
  const averageDuration = $derived.by(() => {
    const timed = countedFlights.filter((flight) => flight.duration);
    if (!timed.length) return null;
    const total = timed.reduce((sum, f) => sum + (f.duration ?? 0), 0);
    return Duration.fromSeconds(Math.round(total / timed.length));
  });

  /* The totals strip says one sub-line per cell, so compose the extras in */
  const flightsSub = $derived.by(() => {
    const { domestic, international } = domesticSplit;
    if (domestic + international > 0) {
      return `${domestic} domestic · ${international} international`;
    }
    return firstYear && !selectedYears.length ? `since ${firstYear}` : null;
  });
  const distanceSub = $derived(
    `${round(earthCircumnavigations, 2)}× Earth · ${round(moonTraversals, 2)}× Moon · ${round(sunTraversals, 4)}× Sun`,
  );
  const durationSub = $derived.by(() => {
    const parts: string[] = [];
    if (durationWeeks >= 1) parts.push(`≈ ${round(durationWeeks, 1)} weeks`);
    if (averageDuration) {
      parts.push(`${averageDuration.toString(true)} per flight`);
    }
    return parts.join(' · ') || null;
  });
  const airportCountries = $derived(
    new Set(
      countedFlights
        .flatMap((f) => [f.from?.country, f.to?.country])
        .filter(Boolean),
    ).size,
  );

  const canAddFlight = $derived(
    showFilters &&
      hasClientPermission(page.data.authorization, 'flight.create.own'),
  );
  const canImport = $derived(
    showFilters &&
      hasClientPermission(page.data.authorization, 'flight.import.own'),
  );

  const openChart = (key: FlightChartKey, entry?: string) => {
    activeChart = key;
    activeEntry = entry ?? null;
    modalHistory?.push({ activeChart, activeEntry, activeContinent });
  };

  const openContinent = (continent: string) => {
    activeContinent = continent;
    modalHistory?.push({ activeChart, activeEntry, activeContinent });
  };

  const restoreDrilldown = (state: unknown) => {
    const drilldown = state as
      | {
          activeChart?: unknown;
          activeEntry?: unknown;
          activeContinent?: unknown;
        }
      | undefined;
    const chart = drilldown?.activeChart;
    activeChart =
      typeof chart === 'string' && chart in FLIGHT_CHARTS
        ? (chart as FlightChartKey)
        : null;
    activeEntry =
      typeof drilldown?.activeEntry === 'string' ? drilldown.activeEntry : null;
    activeContinent =
      typeof drilldown?.activeContinent === 'string'
        ? drilldown.activeContinent
        : null;
  };

  $effect(() => {
    const closedFromDrilldown =
      wasOpen && !open && (activeChart || activeContinent);
    wasOpen = open;

    if (closedFromDrilldown) {
      activeChart = null;
      activeEntry = null;
      activeContinent = null;
    }

    if (open) {
      setTimeout(() => {
        flightCount = countedFlights.length;
        totalDistance = countedFlights.reduce(
          (acc, curr) => (acc += curr.distance ?? 0),
          0,
        );
        earthCircumnavigations = totalDistance / EARTH_CIRCUMFERENCE_KM;
        const duration = Duration.fromSeconds(
          countedFlights.reduce((acc, curr) => (acc += curr.duration ?? 0), 0),
        );
        totalDurationParts = {
          days: duration.days,
          hours: duration.hours,
          minutes: duration.minutes,
        };
        airports = new Set(
          countedFlights
            .filter((f) => f.from && f.to)
            .flatMap((f) => [f.from!.name, f.to!.name]),
        ).size;
        countriesCount = visitedCountries.filter(wasVisited).length;
        travelDays = travelDayCount(countedFlights);
        totals = flightTotals(countedFlights);
        autopilot = autopilotRatio(countedFlights, { userId: seatUserId });
      }, 200);
    } else {
      flightCount = 0;
      totalDistance = 0;
      totalDurationParts = { days: 0, hours: 0, minutes: 0 };
      airports = 0;
      countriesCount = 0;
      earthCircumnavigations = 0;
      travelDays = 0;
      totals = { airlines: 0, aircraftModels: 0, routes: 0, countries: 0 };
      autopilot = 0;
    }
  });
</script>

{#snippet total(
  label: string,
  sub: string | null,
  cell: string,
  value: import('svelte').Snippet,
)}
  <div class={['min-w-0 border-b py-3 lg:border-b-0', cell]}>
    <div class="text-[13px] text-muted-foreground">{label}</div>
    <div
      class="mt-0.5 flex items-baseline gap-1 whitespace-nowrap text-xl font-bold tracking-tight lg:text-[26px]"
    >
      {@render value()}
    </div>
    {#if sub}
      <div class="truncate text-[13px] text-muted-foreground">{sub}</div>
    {/if}
  </div>
{/snippet}

{#snippet section(title: string, body: import('svelte').Snippet)}
  <section
    class="grid gap-3 border-b py-5 last:border-b-0 lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-4"
  >
    <h3
      class="text-lg font-bold tracking-tight lg:text-[15px] lg:font-semibold"
    >
      {title}
    </h3>
    <div class="min-w-0">{@render body()}</div>
  </section>
{/snippet}

{#snippet lists(keys: FlightChartKey[])}
  <div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each keys as chartKey (chartKey)}
      <RankedList
        {chartKey}
        flights={countedFlights}
        {seatUserId}
        onOpen={openChart}
      />
    {/each}
  </div>
{/snippet}

{#snippet whenCharts()}
  <!-- From the unfiltered year count, so picking a quiet year doesn't resize
       the charts under the pointer -->
  {@const compact = flightsPerYearSource.length < 5}
  <div class="grid gap-6 lg:grid-cols-[1.25fr_1.25fr_0.85fr] lg:gap-10">
    <div class="min-w-0">
      <h4 class="mb-1 text-[13px] font-semibold">Per year</h4>
      <FlightsPerYear
        flights={flightsPerYearSource}
        selected={selectedYears}
        {compact}
        onSelect={canPickYear
          ? (year) => (filters = toggleFilterYear(filters, String(year)))
          : undefined}
      />
    </div>
    <div class="min-w-0">
      <h4 class="mb-1 text-[13px] font-semibold">Per month</h4>
      <FlightsPerMonth flights={countedFlights} {compact} />
    </div>
    <div class="min-w-0">
      <h4 class="mb-1 text-[13px] font-semibold">Per weekday</h4>
      <FlightsPerWeekday flights={countedFlights} {compact} />
    </div>
  </div>
{/snippet}

{#snippet countries()}
  {#if countriesCount === 0 && visitedCountries.length === 0}
    <div class="flex max-w-md items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">
        Tracked separately from flights.
      </p>
      <Button
        href={resolve('/visited-countries')}
        variant="secondary"
        size="sm"
      >
        <Plus size={16} />
        Add
      </Button>
    </div>
  {:else}
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-7">
      <div>
        <div class="text-[13px] text-muted-foreground">Lived or visited</div>
        <div class="text-[26px] font-bold tracking-tight">
          <NumberFlow value={countriesCount} />
        </div>
        <div class="text-[13px] text-muted-foreground">
          {countryStatus.Lived ?? 0} lived, {countryStatus.Visited ?? 0} visited,
          {countryStatus.Wishlist ?? 0} wishlist
        </div>
      </div>
      <div class="space-y-0.5">
        {#each countriesByContinent as [continent, { visited, total: all }] (continent)}
          <BreakdownRow
            share={all ? visited / all : 0}
            value="{visited} of {all}"
            onclick={() => openContinent(continent)}
          >
            <span class="truncate">{continent}</span>
          </BreakdownRow>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet emptyState()}
  <div class="max-w-md py-10">
    {#if flights.length === 0}
      <h3 class="text-xl font-bold tracking-tight">No flights yet</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Statistics appear once you have flights.
        {#if canAddFlight && canImport}
          Add one, or import your history from another tracker.
        {/if}
      </p>
      <div class="mt-4 flex gap-2">
        {#if canAddFlight}
          <Button onclick={() => (openModalsState.addFlight = true)}>
            Add flight
          </Button>
        {/if}
        {#if canImport}
          <Button
            variant="ghost"
            onclick={() => {
              openModalsState.settingsTab = 'import';
              openModalsState.settings = true;
            }}
          >
            Import
          </Button>
        {/if}
      </div>
    {:else if hasFlightFilters(filters)}
      <h3 class="text-xl font-bold tracking-tight">No flights match</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        None of your {flights.length}
        {pluralize(flights.length, 'flight')} fit the current filters.
      </p>
      <Button
        class="mt-4"
        variant="outline"
        onclick={() => (filters = createDefaultFilters())}
      >
        Clear filters
      </Button>
    {:else}
      <h3 class="text-xl font-bold tracking-tight">No completed flights yet</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Turn on the switch above to include your upcoming flights.
      </p>
    {/if}
  </div>
{/snippet}

{#snippet upcomingSwitch()}
  <!-- Switch after the text, so a right thumb tapping it doesn't cover the
       label that says what it does -->
  <label class="flex items-center gap-2 text-sm text-muted-foreground">
    <!-- Trimmed to the capital letters, so centering lines the switch up
         with the letters in whatever font the device falls back to. Browsers
         without text-box center on the line box instead -->
    <span class="[text-box:trim-both_cap_alphabetic]">
      {includeUpcoming ? 'Including' : 'Excluding'}
      {upcomingCount} upcoming {pluralize(upcomingCount, 'flight')}
    </span>
    <Switch
      checked={includeUpcoming}
      onCheckedChange={(value) => {
        includeUpcoming = value;
        writeIncludeUpcoming(value);
      }}
    />
  </label>
{/snippet}

{#snippet flightsValue()}<NumberFlow value={flightCount} />{/snippet}
{#snippet travelDaysValue()}<NumberFlow value={travelDays} />{/snippet}
{#snippet autopilotValue()}
  {#if autopilot === null}
    <span class="text-muted-foreground">—</span>
  {:else}<NumberFlow value={Math.round(autopilot * 100)} />%{/if}
{/snippet}
{#snippet airlinesValue()}<NumberFlow value={totals.airlines} />{/snippet}
{#snippet aircraftValue()}<NumberFlow value={totals.aircraftModels} />{/snippet}
{#snippet routesValue()}<NumberFlow value={totals.routes} />{/snippet}
{#snippet distanceValue()}
  <NumberFlow
    value={convertDistance(totalDistance, prefs)}
    format={{ maximumFractionDigits: 0 }}
  />
  <span class="text-sm font-medium tracking-normal text-muted-foreground">
    {distanceUnitLabel(prefs)}
  </span>
{/snippet}
{#snippet durationValue()}
  {#if totalDuration.days}<span>
      <NumberFlow value={totalDurationParts.days} />d
    </span>{/if}
  {#if totalDuration.hours}<span>
      <NumberFlow value={totalDurationParts.hours} />h
    </span>{/if}
  {#if totalDuration.minutes}<span>
      <NumberFlow value={totalDurationParts.minutes} />m
    </span>{:else if !totalDuration.days && !totalDuration.hours}0m{/if}
{/snippet}
{#snippet airportsValue()}<NumberFlow value={airports} />{/snippet}
{#snippet countriesValue()}
  <NumberFlow value={countriesCount} />
  {#if countriesCount === 0}
    <Button
      href={resolve('/visited-countries')}
      variant="secondary"
      size="sm"
      class="ml-1 h-6 px-2 font-medium tracking-normal"
    >
      <Plus size={14} />
      Add
    </Button>
  {/if}
{/snippet}

<Modal
  bind:open
  bind:historyHandle={modalHistory}
  class="max-w-full h-full grid-rows-[minmax(0,1fr)] overflow-hidden rounded-none!"
  dialogOnly
  dialogNoPadding
  closeButton={!drillDownOpen}
  onHistoryStateChange={restoreDrilldown}
>
  <!-- Scrolls in here, so a drill-down sheet stays on screen however far down
       the row that opened it was -->
  <div
    class="h-full min-h-0 overflow-y-auto p-6"
    inert={drillDownOpen}
    data-testid="statistics-scroll"
  >
    <h2 class="pr-8 text-3xl font-bold tracking-tight">Statistics</h2>
    <div class="mt-3 space-y-3">
      {#if showScopeBanner}
        <AdminScopeBanner />
      {/if}
      {#if showFilters || upcomingCount > 0}
        <div class="flex items-start gap-3">
          {#if showFilters}
            <div class="flex-1">
              <ResponsiveFilters {flights} bind:filters />
            </div>
          {/if}
          {#if upcomingCount > 0}
            <!-- As tall as the Filter button, so the switch stays level with
                 it when added filters wrap onto more lines -->
            <div class="ml-auto flex h-8 min-w-0 items-center">
              {@render upcomingSwitch()}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if countedFlights.length === 0}
      {@render emptyState()}
    {:else}
      <div
        class={[
          'mt-4 grid grid-cols-6 border-t lg:border-b',
          showCountryStats
            ? 'lg:grid-cols-[0.8fr_1.25fr_1.1fr_0.8fr_0.95fr]'
            : 'lg:grid-cols-[0.8fr_1.25fr_1.1fr_0.8fr]',
        ]}
      >
        {@render total(
          'Flights',
          flightsSub,
          showCountryStats
            ? 'order-1 col-span-2 lg:order-none lg:col-span-1'
            : 'order-1 col-span-3 lg:order-none lg:col-span-1',
          flightsValue,
        )}
        {@render total(
          'Distance',
          distanceSub,
          'order-4 col-span-3 lg:order-none lg:col-span-1 lg:border-l lg:pl-6',
          distanceValue,
        )}
        {@render total(
          'Duration',
          durationSub,
          'order-5 col-span-3 border-l pl-3 lg:order-none lg:col-span-1 lg:pl-6',
          durationValue,
        )}
        {@render total(
          'Airports',
          `in ${airportCountries} ${pluralize(airportCountries, 'country', 'countries')}`,
          showCountryStats
            ? 'order-2 col-span-2 border-l pl-3 lg:order-none lg:col-span-1 lg:pl-6'
            : 'order-2 col-span-3 border-l pl-3 lg:order-none lg:col-span-1 lg:pl-6',
          airportsValue,
        )}
        {#if showCountryStats}
          {@render total(
            'Countries',
            countryStatus.Wishlist
              ? `${countryStatus.Wishlist} on wishlist`
              : null,
            'order-3 col-span-2 border-l pl-3 lg:order-none lg:col-span-1 lg:pl-6',
            countriesValue,
          )}
        {/if}
      </div>

      <div
        class="grid grid-cols-6 lg:grid-cols-[0.8fr_1.25fr_1.1fr_0.8fr_0.95fr] lg:border-b"
      >
        {@render total(
          'Travel days',
          null,
          'order-1 col-span-2 lg:order-none lg:col-span-1',
          travelDaysValue,
        )}
        {@render total(
          'Autopilot ratio',
          'flown as pilot or copilot',
          'order-2 col-span-2 border-l pl-3 lg:order-none lg:col-span-1 lg:border-l lg:pl-6',
          autopilotValue,
        )}
        {@render total(
          'Airlines',
          null,
          'order-3 col-span-2 border-l pl-3 lg:order-none lg:col-span-1 lg:border-l lg:pl-6',
          airlinesValue,
        )}
        {@render total(
          'Aircraft',
          null,
          'order-4 col-span-3 lg:order-none lg:col-span-1 lg:border-l lg:pl-6',
          aircraftValue,
        )}
        {@render total(
          'Routes',
          null,
          'order-5 col-span-3 border-l pl-3 lg:order-none lg:col-span-1 lg:border-l lg:pl-6',
          routesValue,
        )}
      </div>

      {#snippet whereLists()}
        {@render lists(['airports', 'countries', 'routes', 'continents'])}
      {/snippet}
      {#snippet aircraftLists()}
        {@render lists(['airlines', 'aircraft-models', 'aircraft-regs'])}
      {/snippet}
      {#snippet boardLists()}
        {@render lists(['seat-class', 'seat', 'reason'])}
      {/snippet}
      {#snippet seatMapBody()}
        <SeatMap flights={countedFlights} {seatUserId} />
      {/snippet}
      {@render section('When', whenCharts)}
      {@render section('Where', whereLists)}
      {@render section('Airlines and aircraft', aircraftLists)}
      {@render section('On board', boardLists)}
      {@render section('Seat map', seatMapBody)}
      {#snippet punctuality()}
        <PunctualitySection flights={completedFlights} onOpen={openChart} />
      {/snippet}
      {@render section('Punctuality', punctuality)}
    {/if}
    {#if showCountryStats}
      {@render section('Countries', countries)}
    {/if}
  </div>

  {#if activeContinent}
    <ContinentDrillDown
      continent={activeContinent}
      countries={countriesByContinentDetailsData[activeContinent] || []}
      onBack={() => modalHistory?.back()}
    />
  {:else if activeChart}
    <ChartDrillDown
      chartKey={activeChart}
      initialEntry={activeEntry}
      flights={countedFlights}
      onBack={() => modalHistory?.back()}
      {onOpenFlight}
      {seatUserId}
    />
  {/if}
</Modal>
