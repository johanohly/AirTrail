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
  import {
    calculateBounds,
    linearClamped,
    prepareFlightData,
  } from '$lib/utils';
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
  import { Map } from '$lib/components/map';

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
  const rawFlights = trpc.flight.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
  });

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

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

<AddFlightModal bind:open={addFlightModalOpen} />
<ListFlightsModal bind:open={listFlightsModalOpen} {flights} {deleteFlight} />
<StatisticsModal bind:open={statisticsModalOpen} {flights} {user} />
<SettingsModal bind:open={settingsModalOpen} {invalidator} />

<div class="relative h-[100dvh]">
  <Map {flights} />

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
