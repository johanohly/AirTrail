<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { AirplanemodeInactive } from '@o7/icon/material';

  import type { FlightListYear } from './flight-list-groups';
  import FlightCard from './FlightCard.svelte';
  import PastFlightsDivider from './PastFlightsDivider.svelte';
  import SwipeableFlightRow from './SwipeableFlightRow.svelte';

  import type { FlightData } from '$lib/utils';
  import { cn } from '$lib/utils';

  type Flight = FlightData & {
    month?: string | null;
    passengerLabels?: string[];
  };

  let {
    flightsByYear,
    selecting = false,
    selectedFlights = $bindable<number[]>([]),
    onEdit,
    onDelete,
    canUpdateFlight = () => true,
    canDeleteFlight = () => true,
    onShowOnMap,
    readonly = false,
  }: {
    flightsByYear: FlightListYear<Flight>[];
    selecting?: boolean;
    selectedFlights?: number[];
    onEdit?: (flight: FlightData) => void;
    onDelete?: (flight: FlightData) => void;
    canUpdateFlight?: (flight: FlightData) => boolean;
    canDeleteFlight?: (flight: FlightData) => boolean;
    onShowOnMap?: (flight: FlightData) => void;
    readonly?: boolean;
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
    {#each flightsByYear as { year, groups }, yearIndex (year)}
      <div use:autoAnimate>
        {#each groups as group, groupIndex (group.key)}
          {@const isFirstGroup = yearIndex === 0 && groupIndex === 0}
          <!-- Separators sit between groups, outside the swipeable rows so they
               keep their own stacking context. Legs connected by a layover are
               not separated at all. -->
          {#if group.startsPastSection}
            <PastFlightsDivider />
          {:else if !isFirstGroup}
            <div class="relative z-10 h-px bg-border"></div>
          {/if}
          {#each group.flights as flight (flight.id)}
            {@const isSelected =
              !readonly && selecting && selectedFlights.includes(flight.id)}
            <div id="flight-list-row-{flight.id}" class="isolate scroll-mt-24">
              <SwipeableFlightRow
                bind:this={swipeableRefs[flight.id]}
                disabled={selecting || readonly}
                onEdit={readonly || !canUpdateFlight(flight)
                  ? undefined
                  : () => onEdit?.(flight)}
                onDelete={readonly || !canDeleteFlight(flight)
                  ? undefined
                  : () => onDelete?.(flight)}
                onShowOnMap={readonly ||
                !onShowOnMap ||
                !flight.from ||
                !flight.to
                  ? undefined
                  : () => onShowOnMap?.(flight)}
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
                      if (!readonly && selecting) {
                        toggleSelection(flight.id);
                      }
                    }}
                  >
                    <FlightCard
                      {flight}
                      passengerLabels={flight.passengerLabels}
                    />
                  </button>
                {/snippet}
              </SwipeableFlightRow>
            </div>
          {/each}
        {/each}
      </div>
    {/each}
  </div>
{/if}
