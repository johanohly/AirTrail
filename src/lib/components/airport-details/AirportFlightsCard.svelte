<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import { AirlineIcon } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import { mapDetailsState } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';
  import { formatFlightDate, getPreferences } from '$lib/utils/preferences';

  let {
    flights,
    airportId,
    onShowAllDepartures,
    onShowAllArrivals,
    onShowFlight,
  }: {
    flights: FlightData[];
    airportId: number;
    onShowAllDepartures?: () => void;
    onShowAllArrivals?: () => void;
    onShowFlight?: (flightId: number) => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const inlineFlightTarget = 14;

  const byDateDesc = (a: FlightData, b: FlightData) => {
    const ad = a.date?.getTime() ?? 0;
    const bd = b.date?.getTime() ?? 0;
    return bd - ad;
  };

  const departures = $derived(
    flights.filter((f) => f.from?.id === airportId).sort(byDateDesc),
  );
  const arrivals = $derived(
    flights.filter((f) => f.to?.id === airportId).sort(byDateDesc),
  );

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

  const inlineLimitFor = (direction: 'departure' | 'arrival') => {
    const current =
      direction === 'departure' ? departures.length : arrivals.length;
    const other =
      direction === 'departure' ? arrivals.length : departures.length;
    const sectionCount =
      Number(departures.length > 0) + Number(arrivals.length > 0);

    if (sectionCount <= 1) return Math.min(current, inlineFlightTarget);

    const baseShare = Math.floor(inlineFlightTarget / sectionCount);
    const otherShare = Math.min(other, baseShare);
    return Math.min(current, inlineFlightTarget - otherShare);
  };
</script>

{#snippet flightRow(flight: FlightData, direction: 'departure' | 'arrival')}
  {@const other = direction === 'departure' ? flight.to : flight.from}
  {@const dateLabel = flight.date
    ? formatFlightDate(flight.date, flight.datePrecision ?? 'day', prefs)
    : 'Unknown date'}
  {@const flightNumber = formatFlightNumber(flight.flightNumber)}
  {@const subtitle = [other?.name, flightSubtitle(flight)]
    .filter(Boolean)
    .join(' · ')}
  <li>
    <button
      type="button"
      class="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-background/55 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      onclick={() => onShowFlight?.(flight.id)}
      aria-label="Open flight details for {flight.from?.iata ??
        flight.from?.icao ??
        'N/A'} to {flight.to?.iata ?? flight.to?.icao ?? 'N/A'}"
    >
      <div class="flex w-8 shrink-0 justify-center">
        <AirlineIcon airline={flight.airline} size={28} fallback="plane" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-base leading-5 font-semibold tracking-tight">
            {other?.iata ?? other?.icao ?? 'N/A'}
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

{#snippet section(
  title: string,
  Icon: typeof PlaneTakeoff,
  items: FlightData[],
  direction: 'departure' | 'arrival',
  onShowAll?: (flightId?: number) => void,
)}
  {@const visibleItems = items.slice(0, inlineLimitFor(direction))}
  <div>
    <div class="mb-1 flex min-h-8 items-center gap-2">
      <Icon size={14} class="text-muted-foreground" />
      <h4 class="text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {#if items.length > visibleItems.length && onShowAll}
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onclick={() => onShowAll?.()}
        >
          Show all {items.length}
        </Button>
      {:else}
        <span class="ml-auto text-xs text-muted-foreground">{items.length}</span
        >
      {/if}
    </div>
    {#if items.length === 0}
      <p class="text-sm text-muted-foreground py-1">None.</p>
    {:else}
      <ul class="flex flex-col divide-y divide-border/50">
        {#each visibleItems as flight (flight.id)}
          {@render flightRow(flight, direction)}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<section class="flex flex-col gap-4 px-4 py-4">
  {@render section(
    'Departures',
    PlaneTakeoff,
    departures,
    'departure',
    onShowAllDepartures,
  )}
  {@render section(
    'Arrivals',
    PlaneLanding,
    arrivals,
    'arrival',
    onShowAllArrivals,
  )}
</section>
