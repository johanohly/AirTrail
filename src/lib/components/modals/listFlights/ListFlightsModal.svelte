<script lang="ts">
  import { Modal } from "$lib/components/ui/modal";
  import type { Readable } from "svelte/store";
  import type { APIFlight } from "$lib/db";
  import { Card } from "$lib/components/ui/card";
  import {
    Plane,
    PlaneTakeoff,
    PlaneLanding,
    ArrowRight,
    CircleFadingPlus
  } from "@o7/icon/lucide";
  import dayjs from "dayjs";
  import duration from "dayjs/plugin/duration";
  import { Separator } from "$lib/components/ui/separator";
  import { Button } from "$lib/components/ui/button";
  import { LabelledSeparator } from "$lib/components/ui/separator/index.js";
  import { findByIata } from "$lib/utils";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { formatSeat } from "$lib/utils/data";

  dayjs.extend(duration);

  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short"
  });
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "numeric"
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    hour: "numeric",
    minute: "numeric"
  });

  let {
    open = $bindable(),
    flights
  }: {
    open?: boolean;
    flights: Readable<{ data: APIFlight[] | undefined }>;
  } = $props();

  const parsedFlights = $derived.by(() => {
    const data = $flights.data;
    if (!data) return [];

    return data.map((f) => {
      const depDate = f.departure ? dayjs.unix(f.departure).toDate() : null;
      const arrDate = f.arrival ? dayjs.unix(f.arrival).toDate() : null;

      const sameDay =
        depDate && arrDate && dayjs(depDate).isSame(arrDate, "day");
      const arrTime = arrDate
        ? sameDay
          ? timeFormatter.format(arrDate)
          : dateFormatter.format(arrDate)
        : null;

      return {
        ...f,
        from: {
          iata: f.from,
          name: findByIata(f.from)?.name
        },
        to: {
          iata: f.to,
          name: findByIata(f.to)?.name
        },
        duration: dayjs.duration(f.duration, "seconds").format("H[h] m[m]"),
        month: f.departure
          ? monthFormatter.format(dayjs.unix(f.departure).toDate())
          : null,
        depTime: depDate ? dateFormatter.format(depDate) : null,
        arrTime,
        seat: formatSeat(f)
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
        const year = f.departure
          ? dayjs.unix(f.departure).year()
          : "Not specified";
        if (!acc[year]) acc[year] = [];
        acc[year].push(f);
        return acc;
      },
      {} as Record<number | "Not specified", typeof parsedFlights>
    );
  });
</script>

<Modal bind:open classes="max-w-[90%] max-h-[95%] overflow-y-auto">
  <h2 class="text-3xl font-bold tracking-tight">All Flights</h2>
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
            class="flex items-stretch sm:items-center max-sm:flex-col-reverse max-sm:content-start flex-1 h-full min-w-0"
          >
            {#if flight.month}
              <div class="max-sm:hidden flex justify-center shrink-0 w-11">
                <span class="text-lg font-medium">{flight.month}</span>
              </div>
              <Separator
                orientation="vertical"
                class="max-sm:hidden h-10 mx-3"
              />
            {/if}
            {#if flight.depTime && flight.arrTime}
              <div class="flex flex-col w-32 shrink-0">
                <div class="flex items-center">
                  <PlaneTakeoff size="16" class="mr-1" />
                  <p class="text-sm">{flight.depTime}</p>
                </div>
                <div class="flex items-center">
                  <PlaneLanding size="16" class="mr-1" />
                  <p
                    class="text-sm overflow-hidden overflow-ellipsis whitespace-nowrap"
                  >
                    {flight.arrTime}
                  </p>
                </div>
              </div>
              <Separator class="my-4 sm:hidden" />
            {/if}
            <div class="flex flex-col w-48 shrink-0">
              {#if flight.seat}
                <Tooltip.AutoTooltip text={flight.seat} classes="text-sm truncate" />
              {:else}
                <Button class="justify-start px-1" variant="ghost" size="sm">
                  <CircleFadingPlus size="16" class="mr-1" />
                  Add seat
                </Button>
              {/if}
              {#if flight.airline}
                <Tooltip.AutoTooltip text={flight.airline} classes="text-sm text-muted-foreground truncate" />
              {:else}
                <p class="text-sm text-transparent">.</p>
              {/if}
            </div>
            <div class="flex flex-1 px-16">
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
            <Button variant="ghost" size="sm" class="max-sm:hidden">
              Show
              <ArrowRight class="ml-1 size-4" />
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/each}
</Modal>

{#snippet airport(airport)}
<div class="w-11 flex flex-col items-center justify-center">
  <span class="text-lg font-bold">{airport.iata}</span>
  <Tooltip.AutoTooltip text={airport.name} classes="w-32 text-xs text-muted-foreground truncate" />

</div>
{/snippet}
