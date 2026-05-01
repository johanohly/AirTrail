<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import type { FlightData } from '$lib/utils';
  import { formatAsFlightDate } from '$lib/utils/datetime';

  let {
    flights,
    airportId,
    onShowAllDepartures,
    onShowAllArrivals,
  }: {
    flights: FlightData[];
    airportId: number;
    onShowAllDepartures?: () => void;
    onShowAllArrivals?: () => void;
  } = $props();

  const previewLimit = 5;

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
</script>

{#snippet flightRow(flight: FlightData, direction: 'departure' | 'arrival')}
  {@const other = direction === 'departure' ? flight.to : flight.from}
  <li class="py-2 flex items-center gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <span class="text-sm font-medium truncate">
          {other?.iata ?? other?.icao ?? 'N/A'}
        </span>
        <span class="text-xs text-muted-foreground truncate">
          {other?.name ?? ''}
        </span>
      </div>
      <div class="text-[11px] text-muted-foreground">
        {flight.date
          ? formatAsFlightDate(
              flight.date,
              flight.datePrecision ?? 'day',
              true,
              true,
            )
          : 'Unknown date'}
        {#if flight.airline}
          · {flight.airline.name}
        {/if}
      </div>
    </div>
  </li>
{/snippet}

{#snippet section(
  title: string,
  Icon: typeof PlaneTakeoff,
  items: FlightData[],
  direction: 'departure' | 'arrival',
  onShowAll?: () => void,
)}
  <div>
    <div class="mb-1 flex min-h-8 items-center gap-2">
      <Icon size={14} class="text-muted-foreground" />
      <h4 class="text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {#if items.length > previewLimit && onShowAll}
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onclick={onShowAll}
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
        {#each items.slice(0, previewLimit) as flight (flight.id)}
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
