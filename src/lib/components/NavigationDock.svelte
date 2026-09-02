<script lang="ts">
  import {
    ChartColumn,
    GitBranchPlus,
    Grip,
    LayoutList,
    Map,
    Settings,
  } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    canDeduplicateOwnFlights,
    hasClientPermission,
  } from '$lib/authorization/permissions';
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
    testId: 'add-flight-button',
    onClick: () => {
      openModalsState.addFlight = true;
    },
  };
  const listFlightsItem = {
    label: 'List flights',
    icon: LayoutList,
    testId: 'list-flights-button',
    onClick: () => {
      openModalsState.listFlights = true;
    },
  };
  const flightsStatisticsItem = {
    label: 'Statistics',
    icon: ChartColumn,
    testId: 'statistics-button',
    onClick: () => {
      openModalsState.statistics = true;
    },
  };
  const settingsItem = {
    label: 'Settings',
    icon: Settings,
    id: 'settings-button',
    onClick: () => {
      openModalsState.settingsTab = 'general';
      openModalsState.settings = true;
    },
  };

  const otherItems = $derived.by(() => {
    const items = [];
    if (
      canDeduplicateOwnFlights(page.data.authorization) ||
      hasClientPermission(page.data.authorization, 'tools.sql.execute')
    ) {
      items.push({ label: 'Tools', href: '/tools' });
    }
    if (hasClientPermission(page.data.authorization, 'flight.read.own')) {
      items.push({ label: 'Visited countries', href: '/visited-countries' });
    }
    return items;
  });
</script>

<nav
  aria-label="Main navigation"
  class="z-10 absolute bottom-6 left-1/2 translate-x-[-50%]"
>
  <div class="flex gap-4">
    {#if page.url.pathname !== '/'}
      <div transition:flyAndScale>
        <DockFloatingItem href="/" label="Home">
          <Map />
        </DockFloatingItem>
      </div>
    {/if}
    <Dock>
      {#if hasClientPermission(page.data.authorization, 'flight.create.own')}
        <DockTooltipItem item={addFlightItem} />
      {/if}
      {#if page.url.pathname === '/' && hasClientPermission(page.data.authorization, 'flight.read.own')}
        <DockTooltipItem item={listFlightsItem} />
        <DockTooltipItem item={flightsStatisticsItem} />
      {/if}
      {#if otherItems.length > 0}
        <DockDropdownItem items={otherItems} label="More">
          <Grip />
        </DockDropdownItem>
      {/if}
      <Separator orientation="vertical" class="h-full w-px" />
      <DockTooltipItem item={settingsItem} />
    </Dock>
  </div>
</nav>
