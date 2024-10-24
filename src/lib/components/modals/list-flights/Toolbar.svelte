<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { SquareDashedMousePointer, X } from '@o7/icon/lucide';
  import Filters from './Filters.svelte';
  import type { FlightData } from '$lib/utils';

  let {
    flights = $bindable(),
    filters = $bindable(),
    selecting = $bindable(),
    selectedFlights = $bindable(),
  }: {
    flights: FlightData[];
    filters: {
      from: string[];
      to: string[];
    };
    selecting: boolean;
    selectedFlights: number[];
  } = $props();
</script>

<div class="flex justify-between items-center">
  <Filters bind:flights bind:filters />
  <div class="flex gap-2">
    {#if selecting}
      <Button
        disabled={selectedFlights.length === 0}
        class="gap-2"
        variant="destructiveOutline"
      >
        <X size={20} />
        Delete
      </Button>
    {/if}
    <Button
      onclick={() => {
        selecting = !selecting;
        selectedFlights = [];
      }}
      class="gap-2"
      variant={'outline'}
    >
      <SquareDashedMousePointer size={20} />
      {#if selecting}
        Cancel
      {:else}
        Select
      {/if}
    </Button>
  </div>
</div>
