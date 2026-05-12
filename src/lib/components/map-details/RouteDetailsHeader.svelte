<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { openAirportDetails } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import { distanceUnitLabel, formatTime } from '$lib/utils/preferences';
  import type { Preferences } from '$lib/zod/user';

  type RouteAirport = NonNullable<FlightData['from']>;

  let {
    routeAirports,
    prefs,
    now,
    distance,
  }: {
    routeAirports: { from: RouteAirport; to: RouteAirport };
    prefs: Preferences;
    now: Date;
    distance: number | null;
  } = $props();

  const airportCode = (airport: RouteAirport) => airport.iata ?? airport.icao;
  const airportPlace = (airport: RouteAirport) =>
    airport.municipality ?? airport.name;

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

  const routeTimeDeltaLabel = $derived.by(() => {
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
