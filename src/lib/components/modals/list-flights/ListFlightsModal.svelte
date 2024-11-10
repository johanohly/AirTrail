<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import { Card } from '$lib/components/ui/card';
  import { Plane, PlaneTakeoff, PlaneLanding, X } from '@o7/icon/lucide';
  import { LabelledSeparator, Separator } from '$lib/components/ui/separator';
  import { cn, type FlightData } from '$lib/utils';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { formatSeat } from '$lib/utils/data/data';
  import { Confirm } from '$lib/components/helpers';
  import { EditFlightModal } from '$lib/components/modals';
  import { airlineFromICAO } from '$lib/utils/data/airlines';
  import { isAfter, isBefore, isSameDay } from 'date-fns';
  import {
    Duration,
    formatAsDate,
    formatAsDateTime,
    formatAsMonth,
    formatAsTime,
    isUsingAmPm,
  } from '$lib/utils/datetime';
  import Toolbar from './Toolbar.svelte';
  import type { ToolbarFilters } from './types';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Button } from '$lib/components/ui/button';
  import { filteredFlightDataState } from '$lib/stores.svelte';

  let {
    open = $bindable<boolean>(),
    flights,
    deleteFlight,
  }: {
    open?: boolean;
    flights: FlightData[];
    deleteFlight: (id: number) => Promise<void>;
  } = $props();

  const parsedFlights = $derived.by(() => {
    const data = flights;
    if (!data) return [];

    return data
      .map((f) => {
        const depDate = f.departure;
        const arrDate = f.arrival;

        const sameDay = depDate && arrDate && isSameDay(depDate, arrDate);
        const arrTime = arrDate
          ? sameDay
            ? formatAsTime(arrDate)
            : formatAsDateTime(arrDate)
          : null;

        const airline = f.airline ? airlineFromICAO(f.airline) : null;

        return {
          ...f,
          from: {
            iata: f.from.IATA,
            icao: f.from.ICAO,
            name: f.from.name,
          },
          to: {
            iata: f.to.IATA,
            icao: f.to.ICAO,
            name: f.to.name,
          },
          duration: f.duration
            ? Duration.fromSeconds(f.duration).toString()
            : '',
          month: formatAsMonth(f.date),
          depTime: depDate ? formatAsDateTime(depDate) : formatAsDate(f.date),
          arrTime,
          seat: formatSeat(f),
          airline,
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

  let filters: ToolbarFilters = $state({
    departureAirports: [],
    arrivalAirports: [],
    fromDate: undefined,
    toDate: undefined,
  });
  const filteredFlights = $derived.by(() => {
    return parsedFlights.filter((f) => {
      if (
        (filters.departureAirports.length &&
          !filters.departureAirports.includes(f.from.icao)) ||
        (filters.arrivalAirports.length &&
          !filters.arrivalAirports.includes(f.to.icao))
      ) {
        return false;
      } else if (
        filters.fromDate &&
        isBefore(f.date, filters.fromDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      } else if (
        filters.toDate &&
        isAfter(f.date, filters.toDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      }
      return true;
    });
  });

  const filteredMapFlights = $derived.by(() => {
    const filteredFlightIds = filteredFlights.map((filteredFlight) => {
      return filteredFlight.id;
    });

    return flights.filter((flight) => {
      return filteredFlightIds.includes(flight.id);
    });
  });

  $effect(() => {
    filteredFlightDataState.flightData = filteredMapFlights;
  });

  const flightsPerPage = 20;
  let page = $state(1);
  const paginatedFlights = $derived.by(() => {
    return filteredFlights.slice(
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
      {} as Record<number, typeof parsedFlights>,
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

<Modal bind:open class="flex flex-col h-full !rounded-none" dialogOnly>
  <h2 class="text-3xl font-bold tracking-tight">All Flights</h2>
  <Toolbar
    bind:flights
    bind:filters
    bind:selecting
    bind:selectedFlights
    bind:page
    {flightsPerPage}
    numOfFlights={filteredFlights.length}
  />
  {#if flightsByYear.length === 0}
    <p class="text-lg text-muted-foreground">No flights found</p>
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
        <div class="space-y-2">
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
                  <div class="flex justify-end w-full">
                    {@render actions(flight)}
                  </div>
                </div>
                <Separator class="my-4 md:hidden" />
                <div class="max-lg:hidden flex flex-col w-48 shrink-0">
                  {@render seatAndAirline(flight)}
                </div>
                <div class="flex flex-1 px-12 md:px-16">
                  <div class="w-full grid grid-cols-[auto_1fr_auto] gap-3">
                    {@render airport(flight.from)}
                    <div class="h-full flex flex-col justify-center">
                      <div class="relative">
                        <div
                          class="relative w-full h-[1px] border-b border-dashed border-dark-2 dark:border-zinc-500"
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
                <div class="hidden md:flex">
                  {@render actions(flight)}
                </div>
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
      <p class="text-sm overflow-hidden overflow-ellipsis whitespace-nowrap">
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

{#snippet actions(flight)}
  <div class="flex items-center gap-2">
    {#key flight}
      <EditFlightModal {flight} triggerDisabled={selecting} />
    {/key}
    <Confirm
      onConfirm={() => deleteFlight(flight.id)}
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
