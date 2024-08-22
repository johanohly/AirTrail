<script lang="ts">
  import { trpc } from '$lib/trpc';
  import { Dock, DockTooltipItem } from '$lib/components/dock';
  import {
    ChartColumn,
    GitBranchPlus,
    Settings,
    LayoutList,
    Trash2,
  } from '@o7/icon/lucide';
  import { Home } from '@o7/icon/material';
  import { Separator } from '$lib/components/ui/separator';
  import { mode, toggleMode } from 'mode-watcher';
  import {
    AttributionControl,
    Control,
    ControlButton,
    ControlGroup,
    DeckGlLayer,
    GeolocateControl,
    MapLibre,
    NavigationControl,
    Popup,
  } from 'svelte-maplibre';
  import { ArcLayer, IconLayer } from '@deck.gl/layers';
  import { calculateBounds, linearClamped } from '$lib/utils';
  import { AIRPORTS } from '$lib/data/airports';
  import { toast } from 'svelte-sonner';
  import { prepareFlightArcData } from '$lib/utils/data';
  import {
    AddFlightModal,
    ListFlightsModal,
    SettingsModal,
    StatisticsModal,
  } from '$lib/components/modals';
  import { Button } from '$lib/components/ui/button';
  import maplibregl from 'maplibre-gl';
  import { OnResizeEnd } from '$lib/components/helpers';
  import { onMount } from 'svelte';

  const PRIMARY_COLOR = [59, 130, 246];

  const PRIMARY = [
    {
      label: 'Add flight',
      icon: GitBranchPlus,
      onClick: () => {
        addFlightModalOpen = true;
      },
    },
    {
      label: 'List flights',
      icon: LayoutList,
      onClick: () => {
        listFlightsModalOpen = true;
      },
    },
    {
      label: 'Statistics',
      icon: ChartColumn,
      onClick: () => {
        statisticsModalOpen = true;
      },
    },
  ];
  const SECONDARY = [
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => {
        settingsModalOpen = true;
      },
    },
  ];

  const { data } = $props();
  const user = data.user;
  const flights = trpc.flight.list.query();

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

  let map: maplibregl.Map | undefined = $state(undefined);
  const style = $derived(
    $mode === 'light'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  );

  function fitFlights() {
    if (!map || !flightArcs) return;

    const bounds = calculateBounds(flightArcs);
    if (!bounds) return;

    map.fitBounds(bounds, {
      padding: { left: 24, right: 24, top: 36, bottom: 36 },
    });
  }

  // Fit flights whenever the flights change
  $effect(() => {
    fitFlights();
  });

  const flightArcs = $derived.by(() => {
    const data = $flights.data;
    if (!data || !data.length) return [];

    return prepareFlightArcData(data);
  });
  const visitedAirports = $derived.by(() => {
    const data = flightArcs;
    if (!data || !data.length) return [];

    let visited: { position: number[]; name: string }[] = [];
    data.forEach((trip) => {
      if (!trip) return;

      if (!visited.includes({ position: trip.from, name: trip.fromName }))
        visited.push({ position: trip.from, name: trip.fromName });
      if (!visited.includes({ position: trip.to, name: trip.toName }))
        visited.push({ position: trip.to, name: trip.toName });
    });

    return visited;
  });

  const deleteFlight = async (id: number) => {
    const toastId = toast.loading('Deleting flight...');
    try {
      await $deleteFlightMutation.mutateAsync(id);
      toast.success('Flight deleted', { id: toastId });
    } catch (error) {
      toast.error('Failed to delete flight', { id: toastId });
    }
  };

  let addFlightModalOpen = $state(false);
  let listFlightsModalOpen = $state(false);
  let statisticsModalOpen = $state(false);
  let settingsModalOpen = $state(false);
</script>

<OnResizeEnd callback={fitFlights} />

<AddFlightModal bind:open={addFlightModalOpen} />
<ListFlightsModal bind:open={listFlightsModalOpen} {flights} {deleteFlight} />
<StatisticsModal bind:open={statisticsModalOpen} {flights} />
<SettingsModal bind:open={settingsModalOpen} {invalidator} />

<div class="relative h-[100dvh]">
  <MapLibre
    on:load={()=> fitFlights()}
    bind:map
    {style}
    diffStyleUpdates
    class="relative h-full"
    attributionControl={false}
  >
    <AttributionControl compact={true} />
    <NavigationControl />
    <GeolocateControl />
    {#if flightArcs.length}
      <Control position="top-left">
        <ControlGroup>
          <ControlButton
            on:click={() => fitFlights()}
            title="Show all flights"
            class="text-black"
          >
            <Home />
          </ControlButton>
        </ControlGroup>
      </Control>
    {/if}

    <DeckGlLayer
      type={ArcLayer}
      data={flightArcs}
      getSourcePosition={(d) => d.from}
      getTargetPosition={(d) => d.to}
      getSourceColor={PRIMARY_COLOR}
      getTargetColor={PRIMARY_COLOR}
      getWidth={(d) => linearClamped(d.distance)}
      getHeight={0}
      greatCircle={true}
    />
    <DeckGlLayer
      type={ArcLayer}
      data={flightArcs}
      getSourcePosition={(d) => d.from}
      getTargetPosition={(d) => d.to}
      getSourceColor={[0, 0, 0, 0]}
      getTargetColor={[0, 0, 0, 0]}
      getWidth={(d) => linearClamped(d.distance) * 8}
      getHeight={0}
      greatCircle={true}
    >
      <Popup openOn="click" let:data let:close>
        <div class="flex flex-col">
          <h4 class="text-lg font-semibold">
            From {data.fromName} to {data.toName}
          </h4>
          <Button
            onclick={() => {
              close();
              deleteFlight(data.id);
            }}
            variant="outline"
            size="icon"
          >
            <Trash2 size="20" />
          </Button>
        </div>
      </Popup>
    </DeckGlLayer>

    <DeckGlLayer
      type={IconLayer}
      data={visitedAirports}
      getPosition={(d) => d.position}
      getIcon={(d) => 'marker'}
      getColor={PRIMARY_COLOR}
      getSize={30}
      iconAtlas="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png"
      iconMapping="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json"
    >
      <Popup openOn="click" let:data>
        {data.name}
      </Popup>
    </DeckGlLayer>

    <!-- Both the size and sizeScale don't really matter a lot, the main values are the maxPixels and minPixels, because the unit is meters -->
    <DeckGlLayer
      type={IconLayer}
      data={AIRPORTS.filter(
        (d) => !visitedAirports.some((v) => v.name === d.name),
      )}
      getPosition={(d) => [d.lon, d.lat]}
      getIcon={(d) => 'marker'}
      getColor={[255, 255, 255]}
      getSize={(d) => linearClamped(d.tier, 4, 18, 50, 100)}
      sizeScale={10}
      sizeMinPixels={0}
      sizeMaxPixels={30}
      sizeUnits="meters"
      iconAtlas="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png"
      iconMapping="https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json"
    >
      <Popup openOn="click" let:data>
        {data.name}
      </Popup>
    </DeckGlLayer>
  </MapLibre>

  <div class="absolute top-0 left-1/2">
    <button onclick={toggleMode}>Toggle</button>
  </div>

  <div class="absolute bottom-6 left-1/2 translate-x-[-50%]">
    <Dock let:mouseX let:distance let:magnification>
      {#each PRIMARY as item}
        <DockTooltipItem {item} {mouseX} {distance} {magnification} />
      {/each}
      <Separator orientation="vertical" class="h-full w-[0.6px]" />
      {#each SECONDARY as item}
        <DockTooltipItem {item} {mouseX} {distance} {magnification} />
      {/each}
    </Dock>
  </div>
</div>
