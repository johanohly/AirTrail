<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    AirlineIcon,
    RouteArrow,
    TimeDisplay,
  } from '$lib/components/display';
  import type { FlightData } from '$lib/utils';
  import { formatFlightDate, getPreferences } from '$lib/utils/preferences';

  let {
    flight,
    onShowRoute,
  }: {
    flight: FlightData;
    onShowRoute?: () => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const flightNumber = $derived(
    flight.flightNumber?.trim()
      ? flight.flightNumber.replace(/([a-zA-Z]{2})(\d+)/, '$1 $2')
      : null,
  );

  const dateLabel = $derived(
    flight.date
      ? formatFlightDate(flight.date, flight.datePrecision ?? 'day', prefs)
      : null,
  );

  const canShowRoute = $derived(!!(flight.from && flight.to) && !!onShowRoute);

  const airportCode = (airport: NonNullable<FlightData['from']>) =>
    airport.iata ?? airport.icao;
</script>

<div class="flex flex-col gap-3 px-4 py-4">
  <div class="flex items-center gap-3">
    <AirlineIcon airline={flight.airline} size={36} fallback="plane" />
    <div class="min-w-0">
      <p class="truncate text-lg leading-tight font-semibold tracking-tight">
        {flightNumber ?? flight.airline?.name ?? 'Flight'}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {#if flightNumber && flight.airline?.name}
          {flight.airline.name}{dateLabel ? ` · ${dateLabel}` : ''}
        {:else}
          {dateLabel ?? ''}
        {/if}
      </p>
    </div>
  </div>

  {#snippet endpoint(
    airport: FlightData['from'],
    time: FlightData['departure'],
    align: 'left' | 'right',
  )}
    <div
      class="flex flex-col gap-1 {align === 'right'
        ? 'items-end text-right'
        : 'items-start text-left'}"
    >
      {#if airport}
        <div class="flex items-center gap-1.5">
          <img
            src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
            alt={airport.country}
            class="h-4 w-6 shrink-0 rounded object-cover shadow-sm"
          />
          <span
            class="text-2xl leading-none font-semibold tracking-tight tabular-nums"
          >
            {airportCode(airport)}
          </span>
        </div>
        {#if time}
          <TimeDisplay
            date={time}
            airportTz={airport.tz}
            airportLabel={airport.iata}
            side="bottom"
            class="text-xs text-muted-foreground tabular-nums"
          />
        {/if}
      {:else}
        <span class="text-2xl font-semibold text-muted-foreground">N/A</span>
      {/if}
    </div>
  {/snippet}

  <button
    type="button"
    class="group grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    disabled={!canShowRoute}
    onclick={() => onShowRoute?.()}
    aria-label="Open route details"
  >
    {@render endpoint(flight.from, flight.departure, 'left')}
    <div class="flex flex-col items-center gap-0.5 text-muted-foreground/70">
      <RouteArrow class="size-5 fill-muted-foreground/70" />
    </div>
    {@render endpoint(flight.to, flight.arrival, 'right')}
  </button>
</div>
