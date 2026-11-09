<script lang="ts">
  import type { Snippet } from 'svelte';

  import { page } from '$app/state';
  import type { Airport } from '$lib/db/types';
  import { codeForAirport } from '$lib/stats/aggregations';
  import {
    distanceRecords,
    durationRecords,
    latitudeRecords,
    speedRecords,
    timeZoneRecord,
  } from '$lib/stats/records';
  import type { FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';
  import {
    convertDistance,
    formatDistance,
    formatFlightDate,
    getPreferences,
  } from '$lib/utils/preferences';

  let {
    flights,
    onOpenFlight,
    onOpenAirport,
  }: {
    flights: FlightData[];
    onOpenFlight?: (flightId: number) => void;
    onOpenAirport?: (airportId: number) => void;
  } = $props();

  const SPEED_UNITS = { km: 'km/h', mi: 'mph', nm: 'kt' } as const;

  const prefs = $derived(getPreferences(page.data.user));

  const byDistance = $derived(distanceRecords(flights));
  const byDuration = $derived(durationRecords(flights));
  const bySpeed = $derived(speedRecords(flights));
  const byLatitude = $derived(latitudeRecords(flights));
  const byZones = $derived(timeZoneRecord(flights));

  const formatDuration = (seconds: number) =>
    Duration.fromSeconds(seconds).toString(true);
  const formatSpeed = (kmh: number) =>
    `${Math.round(convertDistance(kmh, prefs)).toLocaleString()} ${SPEED_UNITS[prefs.distanceUnit]}`;
  const formatLatitude = (latitude: number) =>
    `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`;
  const routeLabel = (flight: FlightData) =>
    [codeForAirport(flight.from), codeForAirport(flight.to)]
      .filter(Boolean)
      .join(' – ') || 'Unknown route';
  // Names the flight behind a record by its number and the day it flew.
  const withFlightDetail = (flight: FlightData, value: string) =>
    [
      value,
      flight.flightNumber,
      flight.date && formatFlightDate(flight.date, flight.datePrecision, prefs),
    ]
      .filter(Boolean)
      .join(' · ');
</script>

{#snippet flag(country: string | null | undefined)}
  {#if country}
    <img
      src="https://flagcdn.com/{country.toLowerCase()}.svg"
      alt=""
      title={country.toUpperCase()}
      class="h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover shadow-xs"
      loading="lazy"
      decoding="async"
    />
  {/if}
{/snippet}

{#snippet card(
  label: string,
  headline: Snippet,
  detail: string,
  onclick: (() => void) | undefined,
)}
  {#snippet content()}
    <div class="text-[13px] text-muted-foreground">{label}</div>
    <div
      class="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xl font-bold tracking-tight lg:text-[26px]"
    >
      {@render headline()}
    </div>
    <div class="truncate text-[13px] text-muted-foreground">{detail}</div>
  {/snippet}
  {#if onclick}
    <button
      type="button"
      class="-mx-2 min-w-0 rounded px-2 py-1 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
      {onclick}
    >
      {@render content()}
    </button>
  {:else}
    <div class="min-w-0">
      {@render content()}
    </div>
  {/if}
{/snippet}

{#snippet flightCard(label: string, flight: FlightData, detail: string)}
  {#snippet headline()}
    {@render flag(flight.from?.country)}
    {@render flag(flight.to?.country)}
    <span class="truncate">{routeLabel(flight)}</span>
  {/snippet}
  {@render card(
    label,
    headline,
    detail,
    onOpenFlight && (() => onOpenFlight?.(flight.id)),
  )}
{/snippet}

{#snippet airportCard(label: string, airport: Airport)}
  {#snippet headline()}
    {@render flag(airport.country)}
    <span class="truncate">{codeForAirport(airport)}</span>
  {/snippet}
  {@render card(
    label,
    headline,
    `${airport.municipality || airport.name} · ${formatLatitude(airport.lat)}`,
    onOpenAirport && (() => onOpenAirport?.(airport.id)),
  )}
{/snippet}

<div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
  {#if byDistance.highest}
    {@render flightCard(
      'Longest route',
      byDistance.highest.flight,
      formatDistance(byDistance.highest.value, prefs),
    )}
  {/if}
  {#if byDuration.highest}
    {@render flightCard(
      'Longest flight',
      byDuration.highest.flight,
      withFlightDetail(
        byDuration.highest.flight,
        formatDuration(byDuration.highest.value),
      ),
    )}
  {/if}
  {#if bySpeed.highest}
    {@render flightCard(
      'Fastest flight',
      bySpeed.highest.flight,
      formatSpeed(bySpeed.highest.value),
    )}
  {/if}
  {#if byDistance.lowest}
    {@render flightCard(
      'Shortest route',
      byDistance.lowest.flight,
      formatDistance(byDistance.lowest.value, prefs),
    )}
  {/if}
  {#if byDuration.lowest}
    {@render flightCard(
      'Shortest flight',
      byDuration.lowest.flight,
      withFlightDetail(
        byDuration.lowest.flight,
        formatDuration(byDuration.lowest.value),
      ),
    )}
  {/if}
  {#if bySpeed.lowest}
    {@render flightCard(
      'Slowest flight',
      bySpeed.lowest.flight,
      formatSpeed(bySpeed.lowest.value),
    )}
  {/if}
  {#if byLatitude.north}
    {@render airportCard('Northernmost airport', byLatitude.north)}
  {/if}
  {#if byLatitude.south}
    {@render airportCard('Southernmost airport', byLatitude.south)}
  {/if}
  {#if byZones}
    {@render flightCard(
      'Most time zones',
      byZones.flight,
      `${byZones.value % 1 ? byZones.value.toFixed(1) : byZones.value} crossed`,
    )}
  {/if}
</div>
