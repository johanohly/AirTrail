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

  // Store refs to SwipeableFlightRow components for resetting
  let swipeableRefs: Record<number, SwipeableFlightRow | undefined> = $state(
    {},
  );

  // Expose a method to reset all swipeable rows
  export const resetAllRows = () => {
    Object.values(swipeableRefs).forEach((ref) => ref?.reset?.());
  };

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
    {#each flightsByYear as { year, flights }, yearIndex (year)}
      {@const isLastYear = yearIndex === flightsByYear.length - 1}
      <div use:autoAnimate>
        {#each flights as flight, index (flight.id)}
          {@const isLastFlight = index === flights.length - 1}
          {@const isSelected = selecting && selectedFlights.includes(flight.id)}
          <div class="isolate">
            <SwipeableFlightRow
              bind:this={swipeableRefs[flight.id]}
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
            <!-- Separator outside swipeable content with its own stacking context -->
            {#if !(isLastFlight && isLastYear)}
              <div class="relative z-10 h-px bg-border"></div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}
