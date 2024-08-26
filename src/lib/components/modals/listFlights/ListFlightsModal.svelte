<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import { Card } from '$lib/components/ui/card';
  import {
    Plane,
    PlaneTakeoff,
    PlaneLanding,
    CircleFadingPlus,
    SquarePen,
    X,
  } from '@o7/icon/lucide';
  import dayjs from 'dayjs';
  import duration from 'dayjs/plugin/duration';
  import { Separator } from '$lib/components/ui/separator';
  import { Button } from '$lib/components/ui/button';
  import { LabelledSeparator } from '$lib/components/ui/separator/index.js';
  import {
    airlineFromICAO,
    cn,
    type FlightData,
    isUsingAmPm,
  } from '$lib/utils';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { formatSeat } from '$lib/utils/data';

  dayjs.extend(duration);

  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    month: 'short',
  });
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
  const datetimeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: 'numeric',
  });

  let {
    open = $bindable(),
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

    return data.map((f) => {
      const depDate = f.departure ? dayjs.unix(f.departure).toDate() : null;
      const arrDate = f.arrival ? dayjs.unix(f.arrival).toDate() : null;

      const sameDay =
        depDate && arrDate && dayjs(depDate).isSame(arrDate, 'day');
      const arrTime = arrDate
        ? sameDay
          ? timeFormatter.format(arrDate)
          : datetimeFormatter.format(arrDate)
        : null;

      const airline = f.airline ? airlineFromICAO(f.airline) : null;

      return {
        ...f,
        from: {
          iata: f.from.IATA,
          name: f.from.name,
        },
        to: {
          iata: f.to.IATA,
          name: f.to.name,
        },
        duration: dayjs.duration(f.duration, 'seconds').format('H[h] m[m]'),
        month: monthFormatter.format(f.date.toDate()),
        depTime: depDate
          ? datetimeFormatter.format(depDate)
          : dateFormatter.format(f.date.toDate()),
        arrTime,
        seat: formatSeat(f),
        airline,
      };
    });
  });

  const filteredFlights = $derived.by(() => {
    return parsedFlights.filter((f) => {
      //return f.to === "CPH";
      return true;
    });
  });

  const flightsByYear = $derived.by(() => {
    return filteredFlights.reduce(
      (acc, f) => {
        const year = f.date.year();
        if (!acc[year]) acc[year] = [];
        acc[year].push(f);
        return acc;
      },
      {} as Record<number, typeof parsedFlights>,
    );
  });
</script>

<Modal bind:open classes="h-full overflow-y-auto !rounded-none" dialogOnly>
  <h2 class="text-3xl font-bold tracking-tight">All Flights</h2>
  {#if Object.keys(flightsByYear).length === 0}
    <p class="text-lg text-muted-foreground">No flights found</p>
  {:else}
    {#each Object.entries(flightsByYear) as [year, flights] (year)}
      <LabelledSeparator classes="mt-4">
        <h3
          class="border px-4 py-1 rounded-full border-dashed text-sm font-medium leading-7"
        >
          {year}
        </h3>
      </LabelledSeparator>
      <div class="space-y-2">
        {#each flights as flight (flight.id)}
          <Card level="2" class="flex items-center p-3">
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
  {#if flight.seat}
    <Tooltip.AutoTooltip text={flight.seat} classes="text-sm truncate" />
  {:else}
    <Button class="justify-start px-1" variant="ghost" size="sm">
      <CircleFadingPlus size="16" class="mr-1" />
      Add seat
    </Button>
  {/if}
  {#if flight.airline}
    <Tooltip.AutoTooltip
      text={flight.airline.name}
      classes="text-sm text-muted-foreground truncate"
    />
  {:else}
    <p class="text-sm text-transparent">.</p>
  {/if}
{/snippet}

{#snippet actions(flight)}
  <div class="flex items-center gap-2">
    <Button variant="outline" size="icon">
      <SquarePen size="20" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      on:click={() => deleteFlight(flight.id)}
    >
      <X size="24" />
    </Button>
  </div>
{/snippet}

{#snippet airport(airport)}
  <div class="w-11 flex flex-col items-center justify-center">
    <span class="text-lg font-bold">{airport.iata}</span>
    <Tooltip.AutoTooltip
      text={airport.name}
      classes="w-32 text-xs text-muted-foreground truncate"
    />
  </div>
{/snippet}
