<script lang="ts">
  import { page } from '$app/state';

  import {
    codeForAirport,
    extremeAirportsByLatitude,
    extremeFlightSpeeds,
    extremeFlights,
    extremeTimeZones,
    type AirportExtreme,
  } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';
  import { Duration } from '$lib/utils/datetime';
  import {
    convertDistance,
    distanceUnitLabel,
    formatDate,
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

  const prefs = $derived(getPreferences(page.data.user));

  const byDistance = $derived(extremeFlights(flights, 'distance'));
  const byDuration = $derived(extremeFlights(flights, 'duration'));
  const bySpeed = $derived(extremeFlightSpeeds(flights));
  const byLatitude = $derived(extremeAirportsByLatitude(flights));
  const byZones = $derived(extremeTimeZones(flights));

  const formatDistance = (km: number) =>
    `${Math.round(convertDistance(km, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}`;
  const formatDuration = (seconds: number) =>
    Duration.fromSeconds(seconds).toString(true);
  const formatSpeed = (kmh: number) =>
    `${Math.round(convertDistance(kmh, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}/h`;
  const formatLatitude = (latitude: number) =>
    `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`;
  const routeLabel = (flight: FlightData) =>
    [codeForAirport(flight.from), codeForAirport(flight.to)]
      .filter(Boolean)
      .join(' – ') || 'Unknown route';
  // Identifies the flight behind a record: its number and the day it flew
  const flightDetail = (flight: FlightData) =>
    [
      flight.flightNumber,
      flight.date && formatDate(flight.date, prefs, flight.from?.tz),
    ]
      .filter(Boolean)
      .join(' · ');
  const withDetail = (flight: FlightData, value: string) =>
    [value, flightDetail(flight)].filter(Boolean).join(' · ');
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

{#snippet flightCard(label: string, flight: FlightData, value: string)}
  {#snippet content()}
    <div class="text-[13px] text-muted-foreground">{label}</div>
    <div
      class="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xl font-bold tracking-tight lg:text-[26px]"
    >
      {@render flag(flight.from?.country)}
      {@render flag(flight.to?.country)}
      <span class="truncate">{routeLabel(flight)}</span>
    </div>
    <div class="truncate text-[13px] text-muted-foreground">{value}</div>
  {/snippet}
  <!-- Opens the flight, like a drill-down row does -->
  {#if onOpenFlight}
    <button
      type="button"
      class="min-w-0 -mx-2 rounded px-2 py-1 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
      onclick={() => onOpenFlight?.(flight.id)}
    >
      {@render content()}
    </button>
  {:else}
    <div class="min-w-0">
      {@render content()}
    </div>
  {/if}
{/snippet}

{#snippet airportCard(label: string, extreme: AirportExtreme)}
  {#snippet content()}
    <div class="text-[13px] text-muted-foreground">{label}</div>
    <div
      class="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xl font-bold tracking-tight lg:text-[26px]"
    >
      {@render flag(extreme.airport.country)}
      <span>{codeForAirport(extreme.airport)}</span>
    </div>
    <div class="truncate text-[13px] text-muted-foreground">
      {extreme.airport.municipality || extreme.airport.name}
      · {formatLatitude(extreme.latitude)}
    </div>
  {/snippet}
  <!-- Focuses the map on the airport, closing this modal first -->
  {#if onOpenAirport}
    <button
      type="button"
      class="min-w-0 -mx-2 rounded px-2 py-1 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
      onclick={() => onOpenAirport?.(extreme.airport.id)}
    >
      {@render content()}
    </button>
  {:else}
    <div class="min-w-0">
      {@render content()}
    </div>
  {/if}
{/snippet}

<div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
  <!-- Rows pair by flight: the longest route's time and speed, then the
       shortest's, then the compass extremes and the longest time on the
       ground -->
  {#if byDistance.longest}
    {@render flightCard(
      'Longest route',
      byDistance.longest.flight,
      formatDistance(byDistance.longest.value),
    )}
  {/if}
  {#if byDuration.longest}
    {@render flightCard(
      'Longest flight',
      byDuration.longest.flight,
      withDetail(
        byDuration.longest.flight,
        formatDuration(byDuration.longest.value),
      ),
    )}
  {/if}
  {#if bySpeed.fastest}
    {@render flightCard(
      'Fastest flight',
      bySpeed.fastest.flight,
      formatSpeed(bySpeed.fastest.value),
    )}
  {/if}
  {#if byDistance.shortest}
    {@render flightCard(
      'Shortest route',
      byDistance.shortest.flight,
      formatDistance(byDistance.shortest.value),
    )}
  {/if}
  {#if byDuration.shortest}
    {@render flightCard(
      'Shortest flight',
      byDuration.shortest.flight,
      withDetail(
        byDuration.shortest.flight,
        formatDuration(byDuration.shortest.value),
      ),
    )}
  {/if}
  {#if bySpeed.slowest}
    {@render flightCard(
      'Slowest flight',
      bySpeed.slowest.flight,
      formatSpeed(bySpeed.slowest.value),
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
      `${byZones.zones % 1 ? byZones.zones.toFixed(1) : byZones.zones} crossed`,
    )}
  {/if}
</div>
