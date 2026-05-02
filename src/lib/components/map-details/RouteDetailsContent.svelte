<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { ChevronRight, Funnel, List, Locate, X } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';
  import RouteArrow from '$lib/components/display/RouteArrow.svelte';
  import type {
    FlightFilters,
    Route,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import {
    normalizeRoute,
    setTempRoute,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import {
    closeMapDetails,
    focusFlightInList,
    focusMapDetails,
    mapDetailsState,
    openAirportDetails,
    openModalsState,
  } from '$lib/state.svelte';
  import { type FlightData } from '$lib/utils';
  import { formatAsFlightDate } from '$lib/utils/datetime';
  import {
    convertDistance,
    distanceUnitLabel,
    formatTime,
    getPreferences,
  } from '$lib/utils/preferences';

  import MapDetailsFrame from './MapDetailsFrame.svelte';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  type RouteAirport = NonNullable<FlightData['from']>;

  const prefs = $derived(getPreferences(page.data.user));

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  const matchesRoute = (flight: FlightData, route: Route) => {
    const fromId = flight.from?.id.toString();
    const toId = flight.to?.id.toString();
    return (
      (fromId === route.a && toId === route.b) ||
      (fromId === route.b && toId === route.a)
    );
  };

  const routeFlights = $derived.by(() => {
    if (!selectedRoute) return [];
    return flights
      .filter((flight) => matchesRoute(flight, selectedRoute))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  });

  const routeAirports = $derived.by(() => {
    if (!selectedRoute) return null;
    const flight = routeFlights.find((f) => f.from && f.to);
    if (!flight?.from || !flight.to) return null;

    if (flight.from.id.toString() === selectedRoute.a) {
      return { from: flight.from, to: flight.to };
    }
    return { from: flight.to, to: flight.from };
  });

  const airlineCount = $derived.by(() => {
    const ids = new Set<number>();
    for (const flight of routeFlights) {
      if (flight.airline) ids.add(flight.airline.id);
    }
    return ids.size;
  });

  const distance = $derived.by(() => {
    const km = routeFlights.find(
      (f) => typeof f.distance === 'number',
    )?.distance;
    if (typeof km !== 'number') return null;
    return Math.round(convertDistance(km, prefs));
  });

  const lastFlownLabel = $derived.by(() => {
    const flight = routeFlights.find((f) => f.date);
    if (!flight?.date) return null;
    return formatAsFlightDate(
      flight.date,
      flight.datePrecision ?? 'day',
      false,
      true,
    );
  });

  const routeFilterActive = $derived.by(() => {
    if (!filters || !selectedRoute) return false;
    return (
      filters.routes.length === 1 &&
      filters.routes[0]?.a === selectedRoute.a &&
      filters.routes[0]?.b === selectedRoute.b &&
      filters.departureAirports.length === 0 &&
      filters.arrivalAirports.length === 0 &&
      filters.airportsEither.length === 0
    );
  });

  const toggleRouteFilter = () => {
    if (!filters || !selectedRoute) return;

    if (routeFilterActive) {
      filters.routes = [];
      return;
    }

    filters.departureAirports = [];
    filters.arrivalAirports = [];
    filters.airportsEither = [];
    filters.routes = [normalizeRoute(selectedRoute.a, selectedRoute.b)];
  };

  const showAllFlights = (flightId?: number) => {
    if (selectedRoute && tempFilters) setTempRoute(tempFilters, selectedRoute);
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
  };

  const localDateLabel = (timeZone: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(now);

  const offsetLabel = (timeZone: string) => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(now);
      const tzn = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
      return tzn.replace(/^GMT/, 'UTC').replace(/^UTC$/, 'UTC+0');
    } catch {
      return 'UTC+0';
    }
  };

  const minutesInZone = (timeZone: string) => {
    const value = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(now);
    const [hour = 0, minute = 0] = value
      .split(':')
      .map((part) => parseInt(part.trim(), 10));
    return hour * 60 + minute;
  };

  const airportCode = (airport: RouteAirport) => airport.iata ?? airport.icao;
  const airportPlace = (airport: RouteAirport) =>
    airport.municipality ?? airport.name;

  const routeTimeDeltaLabel = $derived.by(() => {
    if (!routeAirports) return null;
    try {
      const fromTz = routeAirports.from.tz ?? 'UTC';
      const toTz = routeAirports.to.tz ?? 'UTC';
      let diff = minutesInZone(toTz) - minutesInZone(fromTz);
      if (diff > 12 * 60) diff -= 24 * 60;
      if (diff < -12 * 60) diff += 24 * 60;
      if (diff === 0) return 'same local time';
      const abs = Math.abs(diff);
      const hours = Math.floor(abs / 60);
      const minutes = abs % 60;
      const parts: string[] = [];
      if (hours) parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      return `${airportCode(routeAirports.to)} ${parts.join(' ')} ${diff > 0 ? 'ahead' : 'behind'}`;
    } catch {
      return null;
    }
  });

  const formatFlightNumber = (flightNumber: string | null | undefined) => {
    if (!flightNumber) return null;
    return flightNumber.replace(/([a-zA-Z]{2})(\d+)/, '$1 $2');
  };

  const flightSubtitle = (flight: FlightData) => {
    if (flight.airline?.name) return flight.airline.name;
    if (flight.aircraft?.name && flight.aircraftReg) {
      return `${flight.aircraft.name} · ${flight.aircraftReg}`;
    }
    return flight.aircraft?.name ?? flight.aircraftReg ?? null;
  };

  const previewLimit = 6;
</script>

{#snippet routeStop(airport: RouteAirport)}
  {@const timeZone = airport.tz ?? 'UTC'}
  <button
    type="button"
    class="group w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    onclick={() => openAirportDetails(airport.id)}
    aria-label="Open details for {airport.name}"
  >
    <p class="truncate text-sm font-medium text-muted-foreground">
      {airportPlace(airport)} · {airport.name}
    </p>
    <div class="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-3">
      <div class="flex min-w-0 items-center gap-2 leading-none">
        <img
          src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
          alt={airport.country}
          class="h-6 w-9 shrink-0 rounded object-cover shadow-sm"
        />
        <span
          class="text-4xl leading-none font-semibold tracking-tight text-foreground"
        >
          {airportCode(airport)}
        </span>
        <ChevronRight
          size={18}
          class="shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </div>
      <div class="text-right">
        <p
          class="text-2xl leading-none font-semibold tracking-tight tabular-nums"
        >
          {formatTime(now, prefs, timeZone)}
        </p>
        <p class="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {localDateLabel(timeZone)} · {offsetLabel(timeZone)}
        </p>
      </div>
    </div>
  </button>
{/snippet}

{#snippet header()}
  {#if routeAirports}
    <div class="px-3 py-3">
      {@render routeStop(routeAirports.from)}

      <div
        class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 py-1.5 text-[11px] text-muted-foreground"
      >
        <div class="h-px bg-border/60"></div>
        <div class="flex items-center gap-2 tabular-nums">
          {#if distance !== null}
            <span>{distance} {distanceUnitLabel(prefs)}</span>
          {/if}
          {#if distance !== null && routeTimeDeltaLabel}
            <span aria-hidden="true">·</span>
          {/if}
          {#if routeTimeDeltaLabel}
            <span>{routeTimeDeltaLabel}</span>
          {/if}
        </div>
        <div class="h-px bg-border/60"></div>
      </div>

      {@render routeStop(routeAirports.to)}
    </div>
  {/if}
{/snippet}

{#snippet actionButton(
  label: string,
  Icon: typeof Locate,
  onclick: () => void,
  pressed = false,
)}
  <Tooltip.Root delayDuration={0} disableHoverableContent>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant={pressed ? 'secondary' : 'ghost'}
          size="sm"
          class="h-9 flex-1 px-2 md:size-8 md:flex-none md:px-0"
          {onclick}
          aria-label={label}
          aria-pressed={pressed || undefined}
        >
          <Icon size={16} />
          <span class="text-xs md:sr-only">{label}</span>
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content side="right" sideOffset={8} class="hidden md:block">
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
{/snippet}

{#snippet actions()}
  {#if routeAirports}
    {@render actionButton('Locate route', Locate, focusMapDetails)}
    {#if filters}
      {@render actionButton(
        routeFilterActive ? 'Clear route filter' : 'Filter map to route',
        Funnel,
        toggleRouteFilter,
        routeFilterActive,
      )}
    {/if}
    {@render actionButton('Close details', X, closeMapDetails)}
  {/if}
{/snippet}

{#snippet flightRow(flight: FlightData)}
  {@const dateLabel = flight.date
    ? formatAsFlightDate(flight.date, flight.datePrecision ?? 'day', true, true)
    : 'Unknown date'}
  {@const flightNumber = formatFlightNumber(flight.flightNumber)}
  {@const subtitle = flightSubtitle(flight)}
  <li>
    <button
      type="button"
      class="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onclick={() => showAllFlights(flight.id)}
      aria-label="Open flight {flight.from?.iata ??
        flight.from?.icao ??
        'N/A'} to {flight.to?.iata ?? flight.to?.icao ?? 'N/A'} in flight list"
    >
      <div class="flex w-8 shrink-0 justify-center">
        <AirlineIcon airline={flight.airline} size={28} fallback="plane" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-base leading-5 font-semibold tracking-tight">
            {flight.from?.iata ?? flight.from?.icao ?? 'N/A'}
          </span>
          <RouteArrow class="size-4 fill-muted-foreground/70" />
          <span class="text-base leading-5 font-semibold tracking-tight">
            {flight.to?.iata ?? flight.to?.icao ?? 'N/A'}
          </span>
          {#if flightNumber}
            <span
              class="min-w-0 truncate text-xs font-medium text-muted-foreground tabular-nums"
            >
              {flightNumber}
            </span>
          {/if}
        </div>
        {#if subtitle}
          <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        {/if}
      </div>

      <div
        class="shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums"
      >
        {dateLabel}
      </div>
    </button>
  </li>
{/snippet}

{#snippet body()}
  {#if routeAirports}
    <section class="px-4 py-4">
      <h3 class="mb-2.5 text-xs tracking-wider text-muted-foreground uppercase">
        Route activity
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <div
          class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
        >
          <p class="text-xs text-muted-foreground">Flights</p>
          <p class="mt-1.5 text-2xl leading-none font-semibold tabular-nums">
            <NumberFlow value={routeFlights.length} />
          </p>
        </div>
        <div
          class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
        >
          <p class="text-xs text-muted-foreground">Airlines</p>
          <p class="mt-1.5 text-2xl leading-none font-semibold tabular-nums">
            <NumberFlow value={airlineCount} />
          </p>
        </div>
      </div>
      <div
        class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      >
        {#if distance !== null}
          <span>
            <span class="font-semibold text-foreground tabular-nums">
              {distance}
            </span>
            {distanceUnitLabel(prefs)}
          </span>
        {/if}
        {#if distance !== null && lastFlownLabel}
          <span aria-hidden="true">·</span>
        {/if}
        {#if lastFlownLabel}
          <span
            >last flown <span class="text-foreground">{lastFlownLabel}</span
            ></span
          >
        {/if}
      </div>
    </section>

    <section class="px-4 py-4">
      <div class="mb-1 flex min-h-8 items-center gap-2">
        <List size={14} class="text-muted-foreground" />
        <h3 class="text-xs tracking-wider text-muted-foreground uppercase">
          Flights
        </h3>
        {#if routeFlights.length > previewLimit}
          <Button
            variant="ghost"
            size="sm"
            class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            onclick={() => showAllFlights()}
          >
            Show all {routeFlights.length}
          </Button>
        {:else}
          <span class="ml-auto text-xs text-muted-foreground">
            {routeFlights.length}
          </span>
        {/if}
      </div>
      <ul class="flex flex-col divide-y divide-border/50">
        {#each routeFlights.slice(0, previewLimit) as flight (flight.id)}
          {@render flightRow(flight)}
        {/each}
      </ul>
      {#if routeFlights.length === 0}
        <p class="py-1 text-sm text-muted-foreground">
          No flights on this route.
        </p>
      {/if}
    </section>
  {/if}
{/snippet}

<MapDetailsFrame
  open={!!routeAirports}
  {header}
  {actions}
  onOpenChange={(v) => {
    if (!v) closeMapDetails();
  }}
>
  {@render body()}
</MapDetailsFrame>
