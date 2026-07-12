<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { List } from '@o7/icon/lucide';

  import { AirlineIcon, RouteArrow } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import { mapDetailsState } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import { distanceUnitLabel, formatFlightDate } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  let {
    routeFlights,
    airlineCount,
    distance,
    lastFlownLabel,
    prefs,
    onShowAll,
  }: {
    routeFlights: FlightData[];
    airlineCount: number;
    distance: number | null;
    lastFlownLabel: string | null;
    prefs: Preferences;
    onShowAll: (flightId?: number) => void;
  } = $props();

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
</script>

{#snippet flightRow(flight: FlightData)}
  {@const dateLabel = flight.date
    ? formatFlightDate(flight.date, flight.datePrecision ?? 'day', prefs)
    : 'Unknown date'}
  {@const flightNumber = formatFlightNumber(flight.flightNumber)}
  {@const subtitle = flightSubtitle(flight)}
  <li>
    <button
      type="button"
      class="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onclick={() => onShowAll(flight.id)}
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
          <span
            class="size-2 shrink-0 rounded-full bg-emerald-500 transition-opacity"
            class:opacity-100={mapDetailsState.hoveredFlightTrackId ===
              flight.id}
            class:opacity-0={mapDetailsState.hoveredFlightTrackId !== flight.id}
            aria-hidden="true"
          ></span>
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
        >last flown <span class="text-foreground">{lastFlownLabel}</span></span
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
    <span class="text-xs text-muted-foreground tabular-nums">
      {routeFlights.length}
    </span>
    {#if routeFlights.length > 0}
      <Button
        variant="ghost"
        size="sm"
        class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        onclick={() => onShowAll()}
      >
        Open list
      </Button>
    {/if}
  </div>
  <ul class="flex flex-col divide-y divide-border/50">
    {#each routeFlights as flight (flight.id)}
      {@render flightRow(flight)}
    {/each}
  </ul>
  {#if routeFlights.length === 0}
    <p class="py-1 text-sm text-muted-foreground">No flights on this route.</p>
  {/if}
</section>
