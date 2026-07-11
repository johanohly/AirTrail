<script lang="ts">
  import NumberFlow from '@number-flow/svelte';

  import { page } from '$app/state';
  import { AirlineIcon, RouteArrow } from '$lib/components/display';
  import { pluralize } from '$lib/utils';
  import { formatAsFlightDate } from '$lib/utils/datetime';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  const prefs = $derived(getPreferences(page.data.user));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, clickable }: { data: any; clickable: boolean } = $props();

  const airportCode = (airport: typeof data.from) =>
    airport.iata ?? airport.icao;

  const recentFlights = $derived(
    [...data.flights]
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .slice(0, 5),
  );
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

  <div class="border-t border-border/50 px-4 pt-2.5 pb-3">
    <div class="mb-1 flex items-center gap-2">
      <h3 class="text-xs font-medium text-muted-foreground">Flights</h3>
      <span class="text-xs text-muted-foreground tabular-nums">
        {data.flights.length}
      </span>
    </div>
    <div class="divide-y divide-border/50">
      {#each recentFlights as flight}
        {@const [fromCode, toCode] = flight.route.split(' - ')}
        <div
          class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2"
        >
          <div class="flex w-7 shrink-0 justify-center">
            <AirlineIcon
              airline={flight.airline || null}
              size={22}
              fallback="plane"
            />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm leading-4 font-semibold tracking-tight">
                {fromCode}
              </span>
              <RouteArrow class="size-3.5 fill-muted-foreground/70" />
              <span class="text-sm leading-4 font-semibold tracking-tight">
                {toCode}
              </span>
            </div>
            {#if flight.airline}
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                {flight.airline.name}
              </p>
            {/if}
          </div>
          <div
            class="shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums"
          >
            {flight.date
              ? formatAsFlightDate(
                  flight.date,
                  flight.datePrecision ?? 'day',
                  true,
                  true,
                )
              : 'Unknown date'}
          </div>
        </div>
      {/each}
    </div>

    {#if data.flights.length > 5}
      <p class="mt-1.5 text-xs text-muted-foreground">
        +{data.flights.length - 5} more
      </p>
    {/if}
  </div>

  {#if clickable}
    <div class="border-t border-border/50 px-4 py-2">
      <p class="text-center text-xs text-muted-foreground">
        Click for route details
      </p>
    </div>
  {/if}
</div>
