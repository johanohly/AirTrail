<script lang="ts">
  import type { TZDate } from '@date-fns/tz';
  import autoAnimate from '@formkit/auto-animate';
  import { AirplanemodeInactive } from '@o7/icon/material';

  import FlightCard from './FlightCard.svelte';
  import SwipeableFlightRow from './SwipeableFlightRow.svelte';

  import type { Airline, Airport } from '$lib/db/types';
  import { cn } from '$lib/utils';

  type Flight = {
    id: number;
    from: Airport | null;
    to: Airport | null;
    airline: Airline | null;
    flightNumber: string | null;
    date: TZDate | null;
    month: string | null;
  };

  type YearGroup = {
    year: string;
    flights: Flight[];
  };

  let {
    flightsByYear,
    selecting = false,
    selectedFlights = $bindable<number[]>([]),
    onEdit,
    onDelete,
  }: {
    flightsByYear: YearGroup[];
    selecting?: boolean;
    selectedFlights?: number[];
    onEdit?: (flight: Flight) => void;
    onDelete?: (flight: Flight) => void;
  } = $props();

  const toggleSelection = (flightId: number) => {
    if (selectedFlights.includes(flightId)) {
      selectedFlights = selectedFlights.filter((id) => id !== flightId);
    } else {
      selectedFlights = [...selectedFlights, flightId];
    }
  };
</script>

{#if flightsByYear.length === 0}
  <div class="h-full flex items-center justify-center">
    <AirplanemodeInactive class="text-muted-foreground size-[20dvw]" />
  </div>
{:else}
  <div class="flex flex-col" use:autoAnimate>
    {#each flightsByYear as { year, flights } (year)}
      <div use:autoAnimate>
        {#each flights as flight, index (flight.id)}
          {@const isLast = index === flights.length - 1}
          {@const isSelected = selecting && selectedFlights.includes(flight.id)}
          <div>
            <SwipeableFlightRow
              disabled={selecting}
              onEdit={() => onEdit?.(flight)}
              onDelete={() => onDelete?.(flight)}
            >
              {#snippet children({ isInteracting })}
                <button
                  type="button"
                  class={cn(
                    'w-full px-4 py-4 transition-colors',
                    isSelected
                      ? 'bg-destructive/10 hover:bg-destructive/15'
                      : !isInteracting && 'hover:bg-hover active:bg-hover',
                  )}
                  onclick={() => {
                    if (selecting) {
                      toggleSelection(flight.id);
                    }
                  }}
                >
                  <FlightCard {flight} />
                </button>
              {/snippet}
            </SwipeableFlightRow>
            <!-- Separator outside swipeable content -->
            {#if !isLast}
              <div class="relative z-10 border-b border-border bg-background"></div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}
