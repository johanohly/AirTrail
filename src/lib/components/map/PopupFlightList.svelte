<script lang="ts">
  import { page } from '$app/state';
  import { AirlineIcon, RouteArrow } from '$lib/components/display';
  import type { SimpleFlight } from '$lib/utils';
  import { formatFlightDate, getPreferences } from '$lib/utils/preferences';

  let { flights }: { flights: SimpleFlight[] } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const recentFlights = $derived(
    [...flights]
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .slice(0, 5),
  );
</script>

<div class="border-t border-border/50 px-4 pt-2.5 pb-3">
  <div class="mb-1 flex items-center gap-2">
    <h3 class="text-xs font-medium text-muted-foreground">Flights</h3>
    <span class="text-xs text-muted-foreground tabular-nums">
      {flights.length}
    </span>
  </div>
  <div class="divide-y divide-border/50">
    {#each recentFlights as flight}
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
              {flight.fromCode}
            </span>
            <RouteArrow class="size-3.5 fill-muted-foreground/70" />
            <span class="text-sm leading-4 font-semibold tracking-tight">
              {flight.toCode}
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
            ? formatFlightDate(
                flight.date,
                flight.datePrecision ?? 'day',
                prefs,
              )
            : 'Unknown date'}
        </div>
      </div>
    {/each}
  </div>

  {#if flights.length > 5}
    <p class="mt-1.5 text-xs text-muted-foreground">
      +{flights.length - 5} more
    </p>
  {/if}
</div>
