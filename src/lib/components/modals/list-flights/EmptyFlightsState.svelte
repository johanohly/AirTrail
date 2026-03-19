<script lang="ts">
  import { Plus, PlaneTakeoff } from '@o7/icon/lucide';

  import RouteArrow from '$lib/components/display/RouteArrow.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { Airline } from '$lib/db/types';

  type PreviewAirport = {
    iata: string | null;
    icao: string | null;
    municipality: string | null;
    name: string;
  };
  type PreviewFlight = {
    id: number;
    from: PreviewAirport | null;
    to: PreviewAirport | null;
    airline: Airline | null;
  };

  let {
    flights = [],
    hasTempFilters = false,
    onShowAllFlights,
    onAddFlight,
  }: {
    flights?: PreviewFlight[];
    hasTempFilters?: boolean;
    onShowAllFlights?: () => void;
    onAddFlight?: () => void;
  } = $props();

  const previewFlights = $derived.by(() => {
    if (flights.length > 0) {
      return flights.slice(0, 5);
    }

    return [
      {
        id: 1,
        from: {
          iata: 'JFK',
          icao: null,
          municipality: 'New York',
          name: 'John F Kennedy',
        },
        to: {
          iata: 'LHR',
          icao: null,
          municipality: 'London',
          name: 'Heathrow',
        },
        airline: null,
      },
      {
        id: 2,
        from: {
          iata: 'HND',
          icao: null,
          municipality: 'Tokyo',
          name: 'Haneda',
        },
        to: {
          iata: 'SIN',
          icao: null,
          municipality: 'Singapore',
          name: 'Changi',
        },
        airline: null,
      },
      {
        id: 3,
        from: {
          iata: 'SFO',
          icao: null,
          municipality: 'San Francisco',
          name: 'San Francisco',
        },
        to: {
          iata: 'SEA',
          icao: null,
          municipality: 'Seattle',
          name: 'Seattle-Tacoma',
        },
        airline: null,
      },
      {
        id: 4,
        from: {
          iata: 'CDG',
          icao: null,
          municipality: 'Paris',
          name: 'Charles de Gaulle',
        },
        to: {
          iata: 'FCO',
          icao: null,
          municipality: 'Rome',
          name: 'Fiumicino',
        },
        airline: null,
      },
      {
        id: 5,
        from: {
          iata: 'LAX',
          icao: null,
          municipality: 'Los Angeles',
          name: 'Los Angeles',
        },
        to: { iata: 'NRT', icao: null, municipality: 'Tokyo', name: 'Narita' },
        airline: null,
      },
    ] as PreviewFlight[];
  });

  // Duplicate for infinite scroll illusion
  const scrollCards = $derived([...previewFlights, ...previewFlights]);

  const isFilteredEmpty = $derived(flights.length > 0);
  const title = $derived(
    isFilteredEmpty ? 'No flights found' : 'No flights yet',
  );
  const description = $derived.by(() => {
    if (!isFilteredEmpty) {
      return 'Start logging your flights to track routes, airlines, and travel patterns over time.';
    }

    if (hasTempFilters) {
      return 'No flights match this airport or route. Try showing all flights or adjusting your filters.';
    }

    return 'Your current filters don\u2019t match any flights. Try relaxing them to see results.';
  });

  const getCode = (airport: PreviewAirport | null) =>
    airport?.iata || airport?.icao || 'N/A';
  const getCity = (airport: PreviewAirport | null) =>
    airport?.municipality || airport?.name || 'Unknown';
</script>

<div
  class="mx-4 mb-4 flex flex-col items-center justify-center gap-6 rounded-lg border border-border px-4 py-10 md:mt-4 md:mx-0 md:mb-0 md:min-h-[500px]"
>
  <!-- Scrolling cards -->
  <div
    class="h-36 w-full max-w-64 overflow-hidden px-4 [mask-image:linear-gradient(transparent,black_10%,black_90%,transparent)]"
  >
    <div class="animate-infinite-scroll-y flex flex-col">
      {#each scrollCards as flight, idx (idx)}
        <div
          class="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[0_4px_12px_0_#0000000D]"
        >
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <span class="text-sm font-bold tracking-wide">
              {getCode(flight.from)}
            </span>
            <RouteArrow class="size-[14px] fill-muted-foreground" />
            <span class="text-sm font-bold tracking-wide">
              {getCode(flight.to)}
            </span>
          </div>
          <span class="truncate text-xs text-muted-foreground">
            {getCity(flight.from)}
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Text -->
  <div class="max-w-sm text-pretty text-center">
    <span class="text-base font-medium text-foreground">{title}</span>
    <p class="mt-2 text-pretty text-sm text-muted-foreground">
      {description}
    </p>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-2">
    {#if !isFilteredEmpty && onAddFlight}
      <Button class="gap-2" onclick={onAddFlight}>
        <Plus size={16} />
        Add flight
      </Button>
    {/if}
    {#if hasTempFilters && onShowAllFlights}
      <Button
        variant="outline"
        class="gap-2"
        onclick={onShowAllFlights}
      >
        <PlaneTakeoff size={16} />
        Show all flights
      </Button>
    {/if}
  </div>
</div>
