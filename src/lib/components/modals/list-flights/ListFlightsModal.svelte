<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { Plane, PlaneTakeoff, PlaneLanding, X } from '@o7/icon/lucide';
  import { AirplanemodeInactive } from '@o7/icon/material';
  import { isBefore } from 'date-fns';

  import Toolbar from './Toolbar.svelte';

  import type { FlightFilters } from '$lib/components/flight-filters/types';
  import { Confirm } from '$lib/components/helpers';
  import { EditFlightModal } from '$lib/components/modals';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Modal } from '$lib/components/ui/modal';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { LabelledSeparator, Separator } from '$lib/components/ui/separator';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn, type FlightData } from '$lib/utils';
  import { formatAircraft } from '$lib/utils/data/aircraft';
  import { formatSeat } from '$lib/utils/data/data';
  import {
    Duration,
    formatAsDate,
    formatAsDateTime,
    formatAsMonth,
    isUsingAmPm,
  } from '$lib/utils/datetime';

  let {
    open = $bindable<boolean>(),
    filters = $bindable<FlightFilters | undefined>(),
    flights,
    filteredFlights,
    deleteFlight,
    readonly = false,
  }: {
    open?: boolean;
    filters?: FlightFilters;
    flights: FlightData[];
    filteredFlights: FlightData[];
    deleteFlight?: (id: number) => Promise<void>;
    readonly?: boolean;
  } = $props();

  const formattedFlights = $derived.by(() => {
    const data = filteredFlights;
    if (!data) return [];

    return data
      .map((f) => {
        const depDate = f.departure;
        const arrDate = f.arrival;

        return {
          ...f,
          from: {
            iata: f.from.iata,
            icao: f.from.icao,
            name: f.from.name,
          },
          to: {
            iata: f.to.iata,
            icao: f.to.icao,
            name: f.to.name,
          },
          duration: f.duration
            ? Duration.fromSeconds(f.duration).toString()
            : '',
          month: formatAsMonth(f.date),
          depTime: depDate ? formatAsDateTime(depDate) : formatAsDate(f.date),
          arrTime: arrDate ? formatAsDateTime(arrDate) : null,
          seat: formatSeat(f),
        };
      })
      .sort((a, b) => {
        if (a.departure && b.departure) {
          return isBefore(a.departure, b.departure) ? 1 : -1;
        } else {
          return isBefore(a.date, b.date) ? 1 : -1;
        }
      });
  });

  const flightsPerPage = 20;
  let page = $state(1);
  const paginatedFlights = $derived.by(() => {
    return formattedFlights.slice(
      (page - 1) * flightsPerPage,
      page * flightsPerPage,
    );
  });

  const flightsByYear = $derived.by(() => {
    const raw = paginatedFlights.reduce(
      (acc, f) => {
        const year = f.date.getFullYear();
        if (!acc[year]) acc[year] = [];
        acc[year].push(f);
        return acc;
      },
      {} as Record<number, typeof formattedFlights>,
    );
    return Object.entries(raw)
      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
      .map(([year, flights]) => {
        return { year, flights };
      });
  });

  let selecting = $state(false);
  let selectedFlights = $state<number[]>([]);
</script>

<Modal
  bind:open
  class="max-w-full flex flex-col h-full rounded-none!"
  dialogOnly
>
  <h2 class="text-3xl font-bold tracking-tight">All Flights</h2>
  {#if filters && !readonly}
    <Toolbar
      bind:filters
      bind:flights
      bind:selecting
      bind:selectedFlights
      bind:page
      {flightsPerPage}
      numOfFlights={filteredFlights.length}
    />
  {/if}
  {#if flightsByYear.length === 0}
    <div class="h-full flex items-center justify-center">
      <AirplanemodeInactive class="text-muted-foreground size-[20dvw]" />
    </div>
  {:else}
    <ScrollArea type="hover">
      {#each flightsByYear as { year, flights } (year)}
        <LabelledSeparator class="mt-4 mb-2">
          <h3
            class="border px-4 py-1 rounded-full border-dashed text-sm font-medium leading-7"
          >
            {year}
          </h3>
        </LabelledSeparator>
        <div class="space-y-2" use:autoAnimate>
          {#each flights as flight (flight.id)}
            <Card
              onclick={() => {
                if (selecting) {
                  if (selectedFlights.includes(flight.id)) {
                    selectedFlights = selectedFlights.filter(
                      (id) => id !== flight.id,
                    );
                  } else {
                    selectedFlights = [...selectedFlights, flight.id];
                  }
                }
              }}
              level="2"
              class={cn('flex items-center p-3', {
                'cursor-pointer border-zinc-600 border-dotted border-2':
                  selecting,
                'border-destructive border-solid':
                  selecting && selectedFlights.includes(flight.id),
              })}
            >
              <div
                class="flex items-stretch md:items-center max-md:flex-col-reverse max-md:content-start flex-1 h-full min-w-0"
              >
                <div class="max-md:hidden flex justify-center shrink-0 w-11">
                  <span class="text-lg font-medium">{flight.month}</span>
                </div>
                <Separator
                  orientation="vertical"
                  class="max-md:hidden h-10 mx-3"
                />
                <div
                  class={cn(
                    'max-md:hidden flex flex-col shrink-0',
                    isUsingAmPm() ? 'w-36' : 'w-32',
                  )}
                >
                  {@render flightTimes(flight)}
                </div>
                <div class="px-4 flex md:hidden">
                  <div
                    class={cn(
                      'flex flex-col shrink-0',
                      isUsingAmPm() ? 'w-36' : 'w-32',
                    )}
                  >
                    {@render flightTimes(flight)}
                  </div>
                  <div class="hidden sm:flex flex-col">
                    {@render seatAndAirline(flight)}
                  </div>
                  {#if !readonly}
                    <div class="flex justify-end w-full">
                      {@render actions(flight)}
                    </div>
                  {/if}
                </div>
                <Separator class="my-4 md:hidden" />
                <div class="max-lg:hidden flex flex-col w-48 shrink-0">
                  {@render seatAndAirline(flight)}
                </div>
                <div class="max-xl:hidden flex flex-col w-48 shrink-0">
                  {@render flightAndTailNumber(flight)}
                </div>
                <div class="flex flex-1 px-12 md:px-16">
                  <div class="w-full grid grid-cols-[auto_1fr_auto] gap-3">
                    {@render airport(flight.from)}
                    <div class="h-full flex flex-col justify-center">
                      <div class="relative">
                        <div
                          class="relative w-full h-px border-b border-dashed border-dark-2 dark:border-zinc-500"
                        >
                          <div
                            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-1 bg-card dark:bg-dark-2 text-dark-2 dark:text-zinc-500"
                          >
                            <div class="flex flex-col items-center">
                              <Plane size="20" />
                              <span class="text-xs">{flight.duration}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {@render airport(flight.to)}
                  </div>
                </div>
                {#if !readonly}
                  <div class="hidden md:flex">
                    {@render actions(flight)}
                  </div>
                {/if}
              </div>
            </Card>
          {/each}
        </div>
      {/each}
    </ScrollArea>
  {/if}
</Modal>

{#snippet flightTimes(flight)}
  <div class="flex items-center">
    <PlaneTakeoff size="16" class="mr-1" />
    <p class="text-sm">{flight.depTime}</p>
  </div>
  <div class="flex items-center">
    {#if flight.arrTime}
      <PlaneLanding size="16" class="mr-1" />
      <p class="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
        {flight.arrTime}
      </p>
    {/if}
    <p class="text-sm text-transparent">.</p>
  </div>
{/snippet}

{#snippet seatAndAirline(flight)}
  {#if flight.seat || flight.airline}
    <Tooltip.AutoTooltip
      text={flight.seat ?? flight.airline.name}
      class="text-sm truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
  {#if flight.airline && flight.seat}
    <Tooltip.AutoTooltip
      text={flight.airline.name}
      class="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet flightAndTailNumber(flight)}
  {@const hasAircraftDetails = flight.aircraft || flight.aircraftReg}
  {#if flight.flightNumber || hasAircraftDetails}
    <Tooltip.AutoTooltip
      text={flight.flightNumber ?? formatAircraft(flight)}
      class="text-sm truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
  {#if flight.flightNumber && hasAircraftDetails}
    <Tooltip.AutoTooltip
      text={formatAircraft(flight)}
      class="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet actions(flight)}
  <div class="flex items-center gap-2">
    {#key flight}
      <EditFlightModal {flight} triggerDisabled={selecting} />
    {/key}
    <Confirm
      onConfirm={() => deleteFlight?.(flight.id)}
      title="Remove Flight"
      description="Are you sure you want to remove this flight? All seats will be removed as well."
    >
      {#snippet triggerContent({ props })}
        <Button variant="outline" size="icon" {...props} disabled={selecting}>
          <X size="24" />
        </Button>
      {/snippet}
    </Confirm>
  </div>
{/snippet}

{#snippet airport(airport)}
  <div class="w-11 flex flex-col items-center justify-center">
    <span class="text-lg font-bold">{airport.iata || airport.icao}</span>
    <Tooltip.AutoTooltip
      text={airport.name}
      class="text-center w-32 text-xs text-muted-foreground truncate"
    />
  </div>
{/snippet}
