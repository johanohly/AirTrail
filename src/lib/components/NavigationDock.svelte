<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import {
    ChartColumn,
    GitBranchPlus,
    Grip,
    LayoutList,
    Map,
    Settings,
  } from '@o7/icon/lucide';
  import {
    Dock,
    DockDropdownItem,
    DockFloatingItem,
    DockTooltipItem,
  } from '$lib/components/dock';
  import { page } from '$app/stores';
  import { flyAndScale } from '$lib/utils';
  import { openModalsState } from '$lib/stores.svelte';

  const addFlightItem = {
    label: 'Add flight',
    icon: GitBranchPlus,
    onClick: () => {
      openModalsState.addFlight = true;
    },
  };
  const listFlightsItem = {
    label: 'List flights',
    icon: LayoutList,
    onClick: () => {
      openModalsState.listFlights = true;
    },
  };
  const flightsStatisticsItem = {
    label: 'Statistics',
    icon: ChartColumn,
    onClick: () => {
      openModalsState.statistics = true;
    },
  };
  const settingsItem = {
    label: 'Settings',
    icon: Settings,
    onClick: () => {
      openModalsState.settings = true;
    },
  };

  const OTHER = [
    {
      label: 'Visited countries',
      href: '/visited-countries',
    },
  ];
</script>

<div class="absolute bottom-6 left-1/2 translate-x-[-50%]">
  <div class="flex gap-4">
    {#if $page.url.pathname !== '/'}
      <div transition:flyAndScale>
        <DockFloatingItem href="/" label="Home">
          <Map />
        </DockFloatingItem>
      </div>
    {/if}
    <Dock>
      <DockTooltipItem item={addFlightItem} />
      {#if $page.url.pathname === '/'}
        <DockTooltipItem item={listFlightsItem} />
        <DockTooltipItem item={flightsStatisticsItem} />
      {/if}
      <DockDropdownItem items={OTHER} label="More">
        <Grip />
      </DockDropdownItem>
      <Separator orientation="vertical" class="h-full w-[1px]" />
      <DockTooltipItem item={settingsItem} />
    </Dock>
  </div>
</div>
