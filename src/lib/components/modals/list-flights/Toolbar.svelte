<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import { Filter, SquareDashedMousePointer, X } from '@o7/icon/lucide';
  import Filters from './Filters.svelte';
  import type { FlightData } from '$lib/utils';
  import type { ToolbarFilters } from './types';

  let {
    flights = $bindable(),
    filters = $bindable(),
    selecting = $bindable(),
    selectedFlights = $bindable(),
  }: {
    flights: FlightData[];
    filters: ToolbarFilters;
    selecting: boolean;
    selectedFlights: number[];
  } = $props();

  let open = $state(false);
</script>

<div class="flex justify-between items-center">
  <div class="flex gap-2 max-xl:hidden">
    <Filters bind:flights bind:filters />
  </div>
  <Popover.Root bind:open>
    <Popover.Trigger asChild let:builder>
      <Button builders={[builder]} variant="outline" size="sm" class="gap-2 xl:hidden">
        <Filter size={16} />
        Filters
      </Button>
    </Popover.Trigger>
    <Popover.Content class="flex flex-col flex-grow-0 gap-2 w-fit">
      <Filters bind:flights bind:filters />
    </Popover.Content>
  </Popover.Root>
  <div class="flex gap-2">
    {#if selecting}
      <Button
        disabled={selectedFlights.length === 0}
        class="gap-2"
        variant="destructiveOutline"
        size="sm"
      >
        <X size={16} />
        Delete
      </Button>
    {/if}
    <Button
      onclick={() => {
        selecting = !selecting;
        selectedFlights = [];
      }}
      class="gap-2"
      variant="outline"
      size="sm"
    >
      <SquareDashedMousePointer size={16} />
      {#if selecting}
        Cancel
      {:else}
        Select
      {/if}
    </Button>
  </div>
</div>
