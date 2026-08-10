<script lang="ts">
  import NumberFlow from '@number-flow/svelte';

  import { page } from '$app/state';
  import type { FlightArc } from '$lib/map/flight-layer-data';
  import { pluralize } from '$lib/utils';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  import PopupFlightList from './PopupFlightList.svelte';

  const prefs = $derived(getPreferences(page.data.user));

  let { data, clickable }: { data: FlightArc; clickable: boolean } = $props();

  const airportCode = (airport: typeof data.from) =>
    airport.iata ?? airport.icao;
</script>

{#snippet routeStop(airport: typeof data.from)}
  <div class="flex items-center gap-2 py-1">
    <img
      src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
      alt={airport.country}
      class="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/15"
    />
    <span class="text-xl leading-none font-semibold tracking-tight">
      {airportCode(airport)}
    </span>
    <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
      {airport.name}
    </span>
  </div>
{/snippet}

<div class="w-80 max-w-[calc(100vw-2rem)]">
  <div class="px-4 pt-3 pb-2.5">
    <h3 class="text-xs font-medium text-muted-foreground">Route</h3>
    <div class="mt-2">
      {@render routeStop(data.from)}

      <div
        class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-[11px] text-muted-foreground tabular-nums"
      >
        <div class="h-px bg-border/60"></div>
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span>
            <NumberFlow
              value={Math.round(convertDistance(data.distance, prefs))}
            />
            {distanceUnitLabel(prefs)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.flights.length} />
            {pluralize(data.flights.length, 'trip')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <NumberFlow value={data.airlines.length} />
            {pluralize(data.airlines.length, 'airline')}
          </span>
        </div>
        <div class="h-px bg-border/60"></div>
      </div>

      {@render routeStop(data.to)}
    </div>
  </div>

  <PopupFlightList flights={data.flights} />

  {#if clickable}
    <div class="border-t border-border/50 px-4 py-2">
      <p class="text-center text-xs text-muted-foreground">
        Click for route details
      </p>
    </div>
  {/if}
</div>
