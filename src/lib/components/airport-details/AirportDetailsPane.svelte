<script lang="ts">
  import { Drawer as DrawerPrimitive } from '@johly/vaul-svelte';
  import { X } from '@o7/icon/lucide';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  import AirportFlightsCard from './AirportFlightsCard.svelte';
  import AirportStatsCard from './AirportStatsCard.svelte';
  import AirportWeatherCard from './AirportWeatherCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Drawer from '$lib/components/ui/drawer';
  import { Separator } from '$lib/components/ui/separator';
  import {
    airportDetailsState,
    closeAirportDetails,
  } from '$lib/state.svelte';
  import { prepareVisitedAirports, type FlightData } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  let { flights }: { flights: FlightData[] } = $props();

  const visited = $derived(prepareVisitedAirports(flights));

  const airport = $derived.by(() => {
    const id = airportDetailsState.airportId;
    if (id === null) return null;
    return visited.find((a) => a.id === id) ?? null;
  });

  const relatedFlights = $derived.by(() => {
    const id = airportDetailsState.airportId;
    if (id === null) return [];
    return flights.filter((f) => f.from?.id === id || f.to?.id === id);
  });

  const drawerOpen = $derived(airportDetailsState.airportId !== null);
  let activeSnapPoint: string | number | null = $state(0.55);
</script>

{#snippet header()}
  {#if airport}
    <div class="flex items-center gap-3 px-4 py-4">
      <img
        src="https://flagcdn.com/{airport.country.toLowerCase()}.svg"
        alt={airport.country}
        class="w-11 h-8 rounded shadow-sm object-cover shrink-0"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-1.5">
          <span class="text-2xl font-semibold tracking-tight leading-none">
            {airport.iata ?? airport.icao}
          </span>
          {#if airport.iata}
            <span
              class="text-xs font-mono text-muted-foreground leading-none"
            >
              {airport.icao}
            </span>
          {/if}
        </div>
        <h2 class="text-sm font-medium leading-tight truncate mt-1">
          {airport.name}
        </h2>
        <p class="text-xs text-muted-foreground truncate mt-0.5">
          {airport.municipality
            ? `${airport.municipality}, ${airport.country}`
            : airport.country}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="shrink-0 -mr-1 h-8 w-8 self-start"
        onclick={closeAirportDetails}
        aria-label="Close airport details"
      >
        <X size={16} />
      </Button>
    </div>
  {/if}
{/snippet}

{#snippet body()}
  {#if airport}
    <AirportStatsCard
      flights={relatedFlights}
      airportId={airport.id}
      airlineCount={airport.airlines.length}
    />
    <AirportWeatherCard icao={airport.icao} tz={airport.tz} lon={airport.lon} />
    <AirportFlightsCard flights={relatedFlights} airportId={airport.id} />
  {/if}
{/snippet}

{#if $isMediumScreen}
  {#if airport}
    <aside
      transition:fly={{ x: -32, duration: 260, easing: cubicOut }}
      class="glass-pane absolute top-3 left-3 z-20 w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-xl flex flex-col overflow-hidden"
    >
      {@render header()}
      <Separator />
      <div class="overflow-y-auto flex-1 divide-y divide-border/60">
        {@render body()}
      </div>
    </aside>
  {/if}
{:else}
  <Drawer.Root
    open={drawerOpen}
    bind:activeSnapPoint
    snapPoints={[0.55, 0.95]}
    onOpenChange={(v) => {
      if (!v) closeAirportDetails();
    }}
    shouldScaleBackground={false}
  >
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay
        class="fixed inset-0 z-40 bg-black/30 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in"
      />
      <DrawerPrimitive.Content
        class="glass-pane z-50 fixed bottom-0 left-0 right-0 flex flex-col rounded-t-2xl h-[95vh] outline-none"
      >
        <div
          class="mx-auto mt-2.5 mb-1 bg-muted-foreground/30 h-1.5 w-10 shrink-0 rounded-full"
        ></div>
        <div class="shrink-0">
          {@render header()}
        </div>
        <Separator />
        <div class="overflow-y-auto flex-1 divide-y divide-border/60 pb-[env(safe-area-inset-bottom)]">
          {@render body()}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  </Drawer.Root>
{/if}
