<script lang="ts">
  import type { Snippet } from 'svelte';

  import FlightCard from '../list-flights/FlightCard.svelte';

  import { pluralize, type FlightData } from '$lib/utils';

  const PREVIEW_LIMIT = 5;

  let {
    flights,
    showAll,
    onShowAll,
    onOpenFlight,
    below,
  }: {
    flights: FlightData[];
    /** Kept by the sheet, so a row reopens as far as it was shown. */
    showAll: boolean;
    onShowAll: () => void;
    onOpenFlight?: (flightId: number) => void;
    /** Extra detail under a flight's card. */
    below?: Snippet<[FlightData]>;
  } = $props();

  const visible = $derived(showAll ? flights : flights.slice(0, PREVIEW_LIMIT));
  const hidden = $derived(flights.length - visible.length);
</script>

<div class="mb-2 ml-2 mt-1 border-l pl-3">
  {#each visible as flight (flight.id)}
    {#if onOpenFlight}
      <button
        type="button"
        class="w-full rounded px-1 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
        onclick={() => onOpenFlight(flight.id)}
      >
        <FlightCard {flight} compact />
        {@render below?.(flight)}
      </button>
    {:else}
      <div class="px-1 py-2">
        <FlightCard {flight} compact />
        {@render below?.(flight)}
      </div>
    {/if}
  {/each}
  {#if hidden > 0}
    <button
      type="button"
      class="rounded px-1 py-1.5 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      onclick={onShowAll}
    >
      Show {hidden} more {pluralize(hidden, 'flight')}
    </button>
  {/if}
</div>
