<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import {
    ChevronLeft,
    ChevronRight,
    Filter,
    SquareDashedMousePointer,
    X,
  } from '@o7/icon/lucide';
  import Filters from './Filters.svelte';
  import { cn, type FlightData } from '$lib/utils';
  import type { ToolbarFilters } from './types';
  import { api, trpc } from '$lib/trpc';
  import { toast } from 'svelte-sonner';
  import { Confirm } from '$lib/components/helpers';
  import NumberFlow from '@number-flow/svelte';

  let {
    flights = $bindable(),
    filters = $bindable(),
    page = $bindable(),
    flightsPerPage,
    numOfFlights,
    selecting = $bindable(),
    selectedFlights = $bindable(),
  }: {
    flights: FlightData[];
    filters: ToolbarFilters;
    page: number;
    flightsPerPage: number;
    numOfFlights: number;
    selecting: boolean;
    selectedFlights: number[];
  } = $props();

  let pages = $derived.by(() => {
    return Math.ceil(numOfFlights / flightsPerPage);
  });
  let showingFrom = $derived.by(() => {
    return numOfFlights === 0 ? 0 : (page - 1) * flightsPerPage + 1;
  });
  let showingTo = $derived.by(() => {
    return Math.min(page * flightsPerPage, numOfFlights);
  });

  // Ensure page is within bounds even after filtering
  $effect(() => {
    if (page > pages && pages !== 0) {
      page = pages;
    }
  });

  let open = $state(false);

  const deleteSelectedFlights = async () => {
    const toastId = toast.loading('Deleting flights');
    try {
      await api.flight.deleteMany.mutate(selectedFlights);
      await trpc.flight.list.utils.invalidate();
      toast.success('Flights deleted', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete flights', { id: toastId });
    }
    selectedFlights = [];
    selecting = false;
  };
</script>

<div class="flex justify-between items-center">
  <div class="flex gap-2 max-xl:hidden">
    <Filters bind:flights bind:filters />
  </div>
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          variant="outline"
          size="sm"
          class="gap-2 xl:hidden"
          {...props}
          disabled={flights.length === 0}
        >
          <Filter size={16} />
          <span class="max-sm:hidden">Filters</span>
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="flex flex-col flex-grow-0 gap-2 w-fit">
      <Filters bind:flights bind:filters />
    </Popover.Content>
  </Popover.Root>
  <div class="flex gap-2">
    <div class="flex items-center gap-2">
      <span class="hidden sm:block text-sm">
        <NumberFlow value={showingFrom} />
        -
        <NumberFlow value={showingTo} />
        of
        <NumberFlow value={numOfFlights} />
      </span>
      <div class="flex sm:gap-2">
        <Button
          onclick={() => {
            page = Math.max(1, page - 1);
          }}
          disabled={page === 1}
          variant="outline"
          size="sm"
          class="max-sm:rounded-r-none max-sm:border-r-0"
        >
          <ChevronLeft size={16} />
        </Button>
        <div
          class={cn('sm:hidden py-1 px-2 flex items-center border', {
            'opacity-50': (page === 1 && page === pages) || pages === 0,
          })}
        >
          <span class="text-sm whitespace-nowrap">
            <NumberFlow value={page} />
            of
            <NumberFlow value={pages} />
          </span>
        </div>
        <Button
          onclick={() => {
            page = Math.min(pages, page + 1);
          }}
          disabled={page === pages || pages === 0}
          variant="outline"
          size="sm"
          class="max-sm:rounded-l-none max-sm:border-l-0"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
    {#if selecting}
      <Confirm
        onConfirm={deleteSelectedFlights}
        title="Delete selected flights"
        description="Are you sure you want to delete the selected flights? This will permanently delete the flights as well as their seats."
        confirmText="Delete"
      >
        {#snippet triggerContent({ props })}
          <Button
            variant="destructiveOutline"
            size="sm"
            class="gap-2"
            {...props}
            disabled={selectedFlights.length === 0}
          >
            <X size={16} />
            <span class="max-sm:hidden">Delete</span>
          </Button>
        {/snippet}
      </Confirm>
    {/if}
    <Button
      onclick={() => {
        selecting = !selecting;
        selectedFlights = [];
      }}
      disabled={flights.length === 0}
      class="gap-2"
      variant="outline"
      size="sm"
    >
      <SquareDashedMousePointer size={16} />
      <span class="max-sm:hidden">
        {#if selecting}
          Cancel
        {:else}
          Select
        {/if}
      </span>
    </Button>
  </div>
</div>
