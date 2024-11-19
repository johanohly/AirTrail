<script lang="ts">
  import {
    ChartColumn,
    GitBranchPlus,
    Grip,
    LayoutList,
    Map,
    Settings,
  } from '@o7/icon/lucide';

  import { page } from '$app/stores';
  import {
    Dock,
    DockDropdownItem,
    DockFloatingItem,
    DockTooltipItem,
  } from '$lib/components/dock';
  import { Separator } from '$lib/components/ui/separator';
  import { openModalsState } from '$lib/state.svelte';
  import { flyAndScale } from '$lib/utils';

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
    id: 'settings-button',
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
