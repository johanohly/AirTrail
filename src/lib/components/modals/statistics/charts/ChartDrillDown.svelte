<script lang="ts">
  import {
    ChartColumn,
    ChevronDown,
    Plane,
    MapPin,
    Route,
  } from '@o7/icon/lucide';
  import { PieChart } from 'layerchart';

  import FlightCard from '../../list-flights/FlightCard.svelte';

  import { AirlineIcon } from '$lib/components/display';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { ContinentMap, type Airline, type Airport } from '$lib/db/types';
  import {
    type ChartKey,
    type FlightChartKey,
    FLIGHT_CHARTS,
    COUNTRY_CHARTS,
  } from '$lib/stats/aggregations';
  import { cn, type FlightData, toTitleCase } from '$lib/utils';

  const FLIGHT_PREVIEW_LIMIT = 5;

  let {
    chartKey,
    data,
    flights,
    onBack,
    onOpenFlight,
    seatUserId,
  }: {
    chartKey: ChartKey;
    data: Record<string, number>;
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
    seatUserId?: string;
  } = $props();

  type RowDetails = {
    airline?: Airline | null;
    airport?: Airport | null;
    routeAirports?: { from: Airport | null; to: Airport | null };
    subtitle?: string | null;
    flights: FlightData[];
  };

  const chartDef = $derived(
    chartKey in FLIGHT_CHARTS
      ? FLIGHT_CHARTS[chartKey as keyof typeof FLIGHT_CHARTS]
      : COUNTRY_CHARTS[chartKey as keyof typeof COUNTRY_CHARTS],
  );
  const isFlightChart = $derived(chartKey in FLIGHT_CHARTS);
  const totalCount = $derived(Object.values(data).reduce((a, b) => a + b, 0));
  const sortedEntries = $derived(
    Object.entries(data).sort(([keyA, a], [keyB, b]) => {
      if (keyA === 'No Data') return 1;
      if (keyB === 'No Data') return -1;
      return b - a;
    }),
  );

  let expandedKey: string | null = $state(null);
  let expandedFlightListKeys: string[] = $state([]);

  const noData = $derived(totalCount === 0);
  const chartData = $derived.by(() => {
    if (noData) {
      return [{ label: 'No data', value: 1 }];
    }
    return sortedEntries.map(([key, value]) => ({
      label: key,
      value,
    }));
  });

  const getPercentage = (value: number) => {
    if (totalCount === 0) return 0;
    return Math.round((value / totalCount) * 100);
  };

  const colorAt = (index: number) =>
    [
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#8b5cf6',
    ][index % 10] as string;

  const colorNextAt = (index: number) =>
    [
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#8b5cf6',
      '#3b82f6',
    ][index % 10] as string;

  const rowColor = (key: string, index: number) =>
    key === 'Others' || key === 'No Data' ? '#71717a' : colorAt(index);

  const rowGradient = (key: string, index: number) =>
    key === 'Others' || key === 'No Data'
      ? '#71717a'
      : `linear-gradient(45deg, ${colorAt(index)}, ${colorNextAt(index)})`;

  const codeForAirport = (airport: Airport | null | undefined) =>
    airport?.iata || airport?.icao || null;

  const routeLabelForFlight = (flight: FlightData) => {
    const fromCode = codeForAirport(flight.from);
    const toCode = codeForAirport(flight.to);
    if (!fromCode || !toCode) return null;
    return `${fromCode}-${toCode}`;
  };

  const labelForFlight = (
    flight: FlightData,
    key: FlightChartKey,
  ): string | null => {
    switch (key) {
      case 'airlines':
        return flight.airline?.name ?? 'No Data';
      case 'aircraft-models':
        return flight.aircraft?.name ?? 'No Data';
      case 'aircraft-regs':
        return flight.aircraftReg ?? 'No Data';
      case 'reason':
        return flight.flightReason
          ? toTitleCase(flight.flightReason)
          : 'No Data';
      case 'continents':
        return flight.to?.continent
          ? ContinentMap[flight.to.continent]
          : 'No Data';
      case 'routes':
        return routeLabelForFlight(flight);
      default:
        return null;
    }
  };

  const hasMatchingSeat = (
    flight: FlightData,
    field: 'seat' | 'seatClass',
    key: string,
  ) => {
    const seats = seatUserId
      ? flight.seats.filter((seat) => seat.userId === seatUserId)
      : flight.seats;

    if (key === 'No Data') {
      if (seatUserId) {
        return seats.length === 0 || seats.some((seat) => !seat[field]);
      }
      return seats.some((seat) => !seat[field]);
    }

    return seats.some(
      (seat) => seat[field] && toTitleCase(seat[field]) === key,
    );
  };

  const flightsForRow = (key: string): FlightData[] => {
    if (!isFlightChart) return [];

    const flightChartKey = chartKey as FlightChartKey;

    switch (flightChartKey) {
      case 'seat':
        return flights.filter((flight) => hasMatchingSeat(flight, 'seat', key));
      case 'seat-class':
        return flights.filter((flight) =>
          hasMatchingSeat(flight, 'seatClass', key),
        );
      case 'airports':
        return flights.filter(
          (flight) =>
            codeForAirport(flight.from) === key ||
            codeForAirport(flight.to) === key,
        );
      case 'routes':
        return flights.filter((flight) => routeLabelForFlight(flight) === key);
      default:
        return flights.filter(
          (flight) => labelForFlight(flight, flightChartKey) === key,
        );
    }
  };

  const airportForKey = (key: string) => {
    for (const flight of flights) {
      if (codeForAirport(flight.from) === key) return flight.from;
      if (codeForAirport(flight.to) === key) return flight.to;
    }
    return null;
  };

  const airlineForKey = (key: string) =>
    flights.find((flight) => flight.airline?.name === key)?.airline ?? null;

  const routeAirportsForKey = (key: string) => {
    const match = flights.find((flight) => routeLabelForFlight(flight) === key);
    if (!match) return null;
    return { from: match.from, to: match.to };
  };

  const airportSubtitle = (airport: Airport | null) => {
    if (!airport) return null;
    const location = [airport.municipality, airport.country?.toUpperCase()]
      .filter(Boolean)
      .join(', ');
    return location || airport.name;
  };

  const rowDetailsFor = (key: string): RowDetails => {
    const matchingFlights = flightsForRow(key);

    if (!isFlightChart) {
      return { flights: matchingFlights };
    }

    switch (chartKey as FlightChartKey) {
      case 'airlines': {
        const airline = airlineForKey(key);
        return {
          airline,
          subtitle: [airline?.iata, airline?.icao].filter(Boolean).join(' / '),
          flights: matchingFlights,
        };
      }
      case 'airports': {
        const airport = airportForKey(key);
        return {
          airport,
          subtitle: airportSubtitle(airport),
          flights: matchingFlights,
        };
      }
      case 'routes': {
        const routeAirports = routeAirportsForKey(key);
        return {
          routeAirports: routeAirports ?? undefined,
          subtitle: routeAirports
            ? `${routeAirports.from?.name ?? 'Unknown'} to ${routeAirports.to?.name ?? 'Unknown'}`
            : null,
          flights: matchingFlights,
        };
      }
      case 'aircraft-models': {
        const aircraft = flights.find(
          (flight) => flight.aircraft?.name === key,
        )?.aircraft;
        return {
          subtitle: aircraft?.icao ?? null,
          flights: matchingFlights,
        };
      }
      case 'aircraft-regs': {
        const aircraft = flights.find(
          (flight) => flight.aircraftReg === key,
        )?.aircraft;
        return {
          subtitle: aircraft?.name ?? null,
          flights: matchingFlights,
        };
      }
      default:
        return { flights: matchingFlights };
    }
  };

  const rowDetails = $derived.by(
    () =>
      Object.fromEntries(
        sortedEntries.map(([key]) => [key, rowDetailsFor(key)]),
      ) as Record<string, RowDetails>,
  );

  const isFlightListExpanded = (key: string) =>
    expandedFlightListKeys.includes(key);

  const expandFlightList = (key: string) => {
    if (isFlightListExpanded(key)) {
      return;
    }
    expandedFlightListKeys = [...expandedFlightListKeys, key];
  };
</script>

<div class="min-h-[80vh]">
  <div class="border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex flex-col justify-center p-6">
      <Button
        variant="link"
        size="sm"
        onclick={onBack}
        class="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-0 h-auto w-fit text-left font-normal underline-offset-2"
      >
        ← Back to Overview
      </Button>
      <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        {chartDef.title}
      </h1>
      <p class="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
        {totalCount} total entries across {flights.length} flights
      </p>
    </div>
  </div>

  <div class="p-6">
    <div class="max-w-7xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-8 items-start">
        <div class="space-y-6">
          <div
            class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
              <h2
                class="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Distribution Overview
              </h2>
            </div>
            <div class="p-6">
              <div class="h-[400px] flex items-center justify-center">
                <PieChart
                  data={chartData}
                  key="label"
                  value="value"
                  cRange={noData
                    ? ['#3b82f650']
                    : chartData.map((d, i) => rowColor(d.label, i))}
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {sortedEntries.length}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Unique Categories
              </div>
            </div>
            <div
              class="rounded-lg shadow border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {totalCount}
              </div>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Total Count
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        >
          <div class="p-6 border-b border-zinc-200 dark:border-zinc-700">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Detailed Breakdown
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              All {sortedEntries.length} categories ranked by frequency
            </p>
          </div>
          <div class="max-h-[500px] overflow-y-auto">
            {#if noData}
              <div
                class="p-8 flex flex-col items-center text-zinc-500 dark:text-zinc-400"
              >
                <ChartColumn class="mb-2" />
                <p class="text-lg font-medium">No data available</p>
                <p class="text-sm">
                  This chart will populate as you add more flights
                </p>
              </div>
            {:else}
              <div class="divide-y divide-zinc-200 dark:divide-zinc-700">
                {#each sortedEntries as [key, value], index (key)}
                  {@const details = rowDetails[key] ?? { flights: [] }}
                  {@const percentage = getPercentage(value)}
                  <div
                    class="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <button
                      type="button"
                      class="w-full p-4 text-left"
                      onclick={() => {
                        if (isFlightChart) {
                          expandedKey = expandedKey === key ? null : key;
                        }
                      }}
                    >
                      <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="flex-shrink-0">
                            {@render rowIcon(key, index, details)}
                          </div>
                          <div class="min-w-0">
                            <div
                              class="font-medium text-zinc-900 dark:text-zinc-100 truncate"
                            >
                              {key}
                            </div>
                            <div
                              class="text-sm text-zinc-600 dark:text-zinc-400 truncate"
                            >
                              {#if details.subtitle}
                                {details.subtitle}
                              {:else if key !== 'No Data'}
                                Rank #{index + 1}
                              {:else}
                                Missing details
                              {/if}
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                          <div class="text-right">
                            <div
                              class="font-bold text-lg text-zinc-900 dark:text-zinc-100"
                            >
                              {value}
                            </div>
                            <div
                              class="text-sm text-zinc-600 dark:text-zinc-400"
                            >
                              {percentage}%
                            </div>
                          </div>
                          {#if isFlightChart}
                            <ChevronDown
                              size={20}
                              class={cn(
                                'text-zinc-500 transition-transform',
                                expandedKey === key && 'rotate-180',
                              )}
                            />
                          {/if}
                        </div>
                      </div>
                      <div class="mt-2">
                        <div
                          class="w-full bg-zinc-200 dark:bg-zinc-600 rounded-full h-2"
                        >
                          <div
                            class="h-2 rounded-full bg-gradient-to-r transition-all duration-300"
                            style="width: {percentage}%; background: {rowGradient(
                              key,
                              index,
                            )}"
                          ></div>
                        </div>
                      </div>
                    </button>

                    {#if expandedKey === key && isFlightChart}
                      {@const flightListExpanded = isFlightListExpanded(key)}
                      {@const visibleFlights = flightListExpanded
                        ? details.flights
                        : details.flights.slice(0, FLIGHT_PREVIEW_LIMIT)}
                      {@const hiddenFlightCount =
                        details.flights.length - visibleFlights.length}
                      <div class="px-4 pb-4">
                        <div
                          class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
                        >
                          <div
                            class="px-4 py-3 flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700"
                          >
                            <p
                              class="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                            >
                              Matching Flights
                            </p>
                            <Badge variant="outline">
                              {details.flights.length}
                            </Badge>
                          </div>
                          {#if details.flights.length}
                            <div
                              class="divide-y divide-zinc-200 dark:divide-zinc-700"
                            >
                              {#each visibleFlights as flight (flight.id)}
                                {#if onOpenFlight}
                                  <button
                                    type="button"
                                    class="w-full p-4 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                                    onclick={() => onOpenFlight(flight.id)}
                                  >
                                    <FlightCard {flight} />
                                  </button>
                                {:else}
                                  <div class="p-4">
                                    <FlightCard {flight} />
                                  </div>
                                {/if}
                              {/each}
                              {#if hiddenFlightCount > 0}
                                <button
                                  type="button"
                                  class="flex min-h-14 w-full items-center justify-center px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                                  onclick={() => expandFlightList(key)}
                                >
                                  Show {hiddenFlightCount} more {hiddenFlightCount ===
                                  1
                                    ? 'flight'
                                    : 'flights'}
                                </button>
                              {/if}
                            </div>
                          {:else}
                            <p
                              class="p-4 text-sm text-zinc-600 dark:text-zinc-400"
                            >
                              No matching flights found.
                            </p>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

{#snippet rowIcon(key: string, index: number, details: RowDetails)}
  {#if details.airline}
    <div
      class="size-10 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
    >
      <AirlineIcon airline={details.airline} size={30} fallback="plane" />
    </div>
  {:else if details.airport}
    <div
      class="size-10 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      {#if details.airport.country}
        <img
          src={`https://flagcdn.com/${details.airport.country.toLowerCase()}.svg`}
          alt=""
          title={details.airport.country.toUpperCase()}
          class="h-5 w-7 object-cover"
          loading="lazy"
          decoding="async"
        />
      {:else}
        <MapPin size={22} class="text-zinc-500" />
      {/if}
    </div>
  {:else if details.routeAirports}
    <div class="flex items-center -space-x-1">
      {@render airportFlag(details.routeAirports.from)}
      {@render airportFlag(details.routeAirports.to)}
    </div>
  {:else if chartKey === 'aircraft-models' || chartKey === 'aircraft-regs'}
    <div
      class="size-10 flex items-center justify-center rounded-lg text-white"
      style="background: {rowGradient(key, index)}"
    >
      <Plane size={22} />
    </div>
  {:else if chartKey === 'routes'}
    <div
      class="size-10 flex items-center justify-center rounded-lg text-white"
      style="background: {rowGradient(key, index)}"
    >
      <Route size={22} />
    </div>
  {:else}
    <div
      class="w-3 h-3 rounded-full bg-gradient-to-r"
      style="background: {rowGradient(key, index)}"
    ></div>
  {/if}
{/snippet}

{#snippet airportFlag(airport: Airport | null)}
  <div
    class="size-8 flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
  >
    {#if airport?.country}
      <img
        src={`https://flagcdn.com/${airport.country.toLowerCase()}.svg`}
        alt=""
        title={airport.country.toUpperCase()}
        class="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    {:else}
      <MapPin size={16} class="text-zinc-500" />
    {/if}
  </div>
{/snippet}
