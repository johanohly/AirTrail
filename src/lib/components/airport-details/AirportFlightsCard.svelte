<script lang="ts">
  import { PlaneLanding, PlaneTakeoff } from '@o7/icon/lucide';

  import type { FlightData } from '$lib/utils';
  import { formatAsFlightDate } from '$lib/utils/datetime';

  let {
    flights,
    airportId,
  }: {
    flights: FlightData[];
    airportId: number;
  } = $props();

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
)}
  <div>
    <div class="flex items-center gap-2 mb-1">
      <Icon size={14} class="text-muted-foreground" />
      <h4 class="text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <span class="text-xs text-muted-foreground ml-auto">{items.length}</span>
    </div>
    {#if items.length === 0}
      <p class="text-sm text-muted-foreground py-1">None.</p>
    {:else}
      <ul class="flex flex-col divide-y divide-border/50">
        {#each items as flight (flight.id)}
          {@render flightRow(flight, direction)}
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<section class="px-4 py-4 flex flex-col gap-4">
  {@render section('Departures', PlaneTakeoff, departures, 'departure')}
  {@render section('Arrivals', PlaneLanding, arrivals, 'arrival')}
</section>
