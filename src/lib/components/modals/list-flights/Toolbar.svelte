<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import {
    ChevronLeft,
    ChevronRight,
    SquareDashedMousePointer,
    X,
  } from '@o7/icon/lucide';
  import { Plus } from '@o7/icon/lucide';
  import { Portal } from 'bits-ui';
  import { toast } from 'svelte-sonner';

  import { page as pageState } from '$app/state';

  import AnimatedSizeContainer from '$lib/components/ui/animated-size-container.svelte';
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import ResponsiveFilters from '$lib/components/flight-filters/ResponsiveFilters.svelte';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import * as Select from '$lib/components/ui/select';
  import {
    flightScopeState,
    setFlightScope,
    type FlightScope,
  } from '$lib/state.svelte';
  import { api, trpc } from '$lib/trpc';
  import type { FlightData } from '$lib/utils';

  let {
    flights = $bindable(),
    filters = $bindable(),
    tempFilters = $bindable(),
    page = $bindable(),
    flightsPerPage,
    numOfFlights,
    selecting = $bindable(),
    selectedFlights = $bindable(),
    hasTempFilters = false,
    onAddFlight,
    modalOpen = true,
  }: {
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    page: number;
    flightsPerPage: number;
    numOfFlights: number;
    selecting: boolean;
    selectedFlights: number[];
    hasTempFilters?: boolean;
    onAddFlight?: () => void;
    modalOpen?: boolean;
  } = $props();

  const users = $derived(pageState.data.users);
  const isAdmin = $derived(pageState.data.user?.role !== 'user');

  const updateScope = (scope: FlightScope) => {
    setFlightScope(
      scope,
      scope === 'user' ? (flightScopeState.userId ?? users[0]?.id) : undefined,
    );
    selecting = false;
    selectedFlights = [];
    page = 1;
  };

  const scopeLabel = $derived.by(() => {
    if (flightScopeState.scope === 'all') return 'Everyone';
    if (flightScopeState.scope === 'user') {
      const scopedUser = users.find((u) => u.id === flightScopeState.userId);
      return scopedUser ? scopedUser.displayName : 'One user';
    }
    return 'Mine';
  });

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

<!-- Top bar: filters + Select (desktop only) -->
<div class="flex flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap items-center gap-2">
    {#if hasTempFilters}
      <Button
        variant="outline"
        size="sm"
        onclick={() => {
          if (tempFilters) {
            tempFilters.airportsEither = [];
            tempFilters.routes = [];
          }
        }}
      >
        Show All Flights
      </Button>
    {/if}
    <ResponsiveFilters
      {flights}
      bind:filters
      bind:tempFilters
      {hasTempFilters}
    />
  </div>

  <div
    class={`ml-auto flex items-center gap-2 ${selecting ? 'pointer-events-none opacity-0' : ''}`}
  >
    {#if isAdmin && users.length > 0}
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" size="sm">
              View: {scopeLabel}
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content align="end" class="w-[320px] space-y-3 p-3">
          <div>
            <p class="text-sm font-medium">Flight visibility</p>
          </div>
          <RadioGroup.Root
            value={flightScopeState.scope}
            onValueChange={(value) => updateScope(value as FlightScope)}
            class="grid grid-cols-3 gap-2"
          >
            <Label
              class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroup.Item value="mine" class="sr-only" />
              Mine
            </Label>
            <Label
              class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroup.Item value="user" class="sr-only" />
              User
            </Label>
            <Label
              class="cursor-pointer rounded-md border-2 bg-background px-3 py-2 text-center text-sm font-medium [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroup.Item value="all" class="sr-only" />
              All
            </Label>
          </RadioGroup.Root>

          {#if flightScopeState.scope === 'user'}
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">User</p>
              <Select.Root
                type="single"
                value={flightScopeState.userId}
                onValueChange={(value) => setFlightScope('user', value)}
              >
                <Select.Trigger>
                  {users.find((u) => u.id === flightScopeState.userId)
                    ?.displayName ?? 'Select a user'}
                </Select.Trigger>
                <Select.Content>
                  {#each users as user (user.id)}
                    <Select.Item value={user.id} label={user.displayName} />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </Popover.Content>
      </Popover.Root>
    {/if}
    <Button
      onclick={() => {
        selecting = true;
        selectedFlights = [];
      }}
      disabled={flights.length === 0}
      class="hidden gap-2 px-3.5 sm:inline-flex"
      variant="outline"
      size="sm"
    >
      <SquareDashedMousePointer size={16} />
      Select
    </Button>
  </div>
</div>

<!-- Fixed bottom toolbar (always present when flights exist) -->
{#if numOfFlights > 0}
  <Portal>
    <div
      class={`pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-5 transition-opacity duration-150 ${modalOpen ? 'opacity-100' : 'opacity-0'}`}
    >
      <div class="pointer-events-auto w-full max-w-[768px]">
        <div
          class="overflow-hidden rounded-xl border bg-background [filter:drop-shadow(0_5px_8px_rgba(34,42,53,0.12))]"
        >
          <AnimatedSizeContainer
            height
            transition={{ type: 'spring', duration: 0.35, bounce: 0.08 }}
          >
            <div class="grid">
              <!-- Idle state: pagination -->
              <div
                class={`col-start-1 row-start-1 transition-[opacity,transform] duration-100 ${selecting ? 'pointer-events-none h-0 overflow-hidden opacity-0' : 'px-4 py-3.5'}`}
              >
                <!-- Row 1: "Viewing X-Y of Z flights" + Previous/Next -->
                <div
                  class="flex items-center justify-between gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <div>
                    <span class="hidden sm:inline-block">Viewing</span>
                    {' '}
                    {#if numOfFlights > 0}
                      <span class="font-medium text-foreground tabular-nums">
                        <NumberFlow value={showingFrom} />-<NumberFlow
                          value={showingTo}
                        />
                      </span>
                      {' '}of{' '}
                    {/if}
                    <span class="font-medium text-foreground tabular-nums">
                      <NumberFlow value={numOfFlights} />
                    </span>
                    {' '}{numOfFlights === 1 ? 'flight' : 'flights'}
                  </div>
                  <div class="flex items-center gap-2">
                    <Button
                      onclick={() => {
                        page = Math.max(1, page - 1);
                      }}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onclick={() => {
                        page = Math.min(pages, page + 1);
                      }}
                      disabled={page === pages || pages === 0}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
                <!-- Row 2 (mobile only): Create + Select -->
                <div class="flex items-center gap-2 pt-3 sm:hidden">
                  {#if onAddFlight}
                    <Button
                      onclick={onAddFlight}
                      class="flex-1 gap-2 text-center"
                      size="sm"
                    >
                      <Plus size={16} />
                      Add flight
                    </Button>
                  {/if}
                  <Button
                    onclick={() => {
                      selecting = true;
                      selectedFlights = [];
                    }}
                    disabled={flights.length === 0}
                    class="gap-2 px-3.5"
                    variant="outline"
                    size="sm"
                  >
                    <SquareDashedMousePointer size={16} />
                    Select
                  </Button>
                </div>
              </div>

              <!-- Select state -->
              <div
                class={`col-start-1 row-start-1 transition-[opacity,transform] duration-100 ${!selecting ? 'pointer-events-none h-0 overflow-hidden opacity-0' : 'px-4 py-3.5'}`}
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => {
                        selecting = false;
                        selectedFlights = [];
                      }}
                      class="rounded-md p-1.5 transition-colors duration-75 hover:bg-accent active:bg-accent"
                    >
                      <X class="size-4" />
                    </button>
                    <span
                      class="whitespace-nowrap text-sm font-medium text-muted-foreground"
                    >
                      <strong class="font-semibold text-foreground">
                        <NumberFlow value={selectedFlights.length} />
                      </strong>
                      {' '}selected
                    </span>
                  </div>

                  <div
                    class={`flex items-center gap-1.5 transition-[transform,opacity] duration-150 ${selectedFlights.length === 0 ? 'pointer-events-none translate-y-[50%] opacity-0' : 'translate-y-0 opacity-100'}`}
                  >
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
                          class="gap-1.5 px-2.5 text-xs"
                          {...props}
                          disabled={selectedFlights.length === 0}
                        >
                          <X size={14} />
                          Delete
                        </Button>
                      {/snippet}
                    </Confirm>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSizeContainer>
        </div>
      </div>
    </div>
  </Portal>
{/if}
