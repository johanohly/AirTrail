<script lang="ts">
  import '../app.css';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { trpc } from '$lib/trpc';
  import { Toaster } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  import { ScreenSize } from '$lib/components/helpers';
  import { appConfig } from '$lib/utils/stores';
  import { Separator } from '$lib/components/ui/separator';
  import {
    Dock,
    DockDropdownItem,
    DockFloatingItem,
    DockTooltipItem,
  } from '$lib/components/dock';
  import {
    ChartColumn,
    GitBranchPlus,
    LayoutList,
    Settings,
    Map,
  } from '@o7/icon/lucide';
  import { openModalsState } from '$lib/stores.svelte';
  import { page } from '$app/stores';
  import { flyAndScale } from '$lib/utils/other';

  const { data, children } = $props();

  $effect(() => {
    appConfig.set(data.appConfig);
  });

  const queryClient = trpc.hydrateFromServer(data.trpc);

  const PRIMARY = [
    {
      label: 'Add flight',
      icon: GitBranchPlus,
      onClick: () => {
        openModalsState.addFlight = true;
      },
    },
    {
      label: 'List flights',
      icon: LayoutList,
      onClick: () => {
        openModalsState.listFlights = true;
      },
    },
    {
      label: 'Statistics',
      icon: ChartColumn,
      onClick: () => {
        openModalsState.statistics = true;
      },
    },
  ];
  const SECONDARY = [
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => {
        openModalsState.settings = true;
      },
    },
  ];
</script>

<ModeWatcher />
<ScreenSize />
<Toaster />
<QueryClientProvider client={queryClient}>
  {@render children()}
  {#if !['/login', '/setup'].includes($page.url.pathname)}
    <div class="absolute bottom-6 left-1/2 translate-x-[-50%]">
      <div class="flex gap-4">
        {#if $page.url.pathname !== '/'}
          <div transition:flyAndScale>
            <DockFloatingItem href="/" label="Home">
              <Map />
            </DockFloatingItem>
          </div>
        {/if}
        <Dock let:mouseX let:distance let:magnification>
          {#each PRIMARY as item}
            <DockTooltipItem {item} {mouseX} {distance} {magnification} />
          {/each}
          <DockDropdownItem items={[{ label: 'Test', href: '/' }]} label="More">
            <Settings />
          </DockDropdownItem>
          <Separator orientation="vertical" class="h-full w-[1px]" />
          {#each SECONDARY as item}
            <DockTooltipItem {item} {mouseX} {distance} {magnification} />
          {/each}
        </Dock>
      </div>
    </div>
  {/if}
</QueryClientProvider>
