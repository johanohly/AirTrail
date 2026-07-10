<script lang="ts">
  import { ControlButton } from 'svelte-maplibre';
  import { page } from '$app/state';

  import FlightsAppearanceTab from './map-appearance/FlightsAppearanceTab.svelte';
  import LayersAppearanceTab from './map-appearance/LayersAppearanceTab.svelte';
  import MapAppearanceTab from './map-appearance/MapAppearanceTab.svelte';

  import * as Popover from '$lib/components/ui/popover';
  import * as Tabs from '$lib/components/ui/tabs';
  import { resetMapPreferences } from '$lib/map/map-preferences.svelte';
  import { openModalsState } from '$lib/state.svelte';

  let {
    openAipConfigured = false,
    showTracksSection = false,
    hasFallbackArcs = true,
  }: {
    openAipConfigured?: boolean;
    showTracksSection?: boolean;
    hasFallbackArcs?: boolean;
  } = $props();

  let popoverOpen = $state(false);
  let activeTab = $state('map');
  const isAdmin = $derived(page.data.user?.role !== 'user');

  const openIntegrationSettings = () => {
    popoverOpen = false;
    openModalsState.settingsTab = 'integrations';
    openModalsState.settings = true;
  };
</script>

<Popover.Root bind:open={popoverOpen}>
  <Popover.Trigger>
    <ControlButton title="Map appearance">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
        />
        <path
          d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
        />
        <path
          d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
        />
      </svg>
    </ControlButton>
  </Popover.Trigger>
  <Popover.Content
    side="left"
    align="start"
    sideOffset={8}
    class="w-[min(calc(100vw-2rem),340px)] overflow-hidden p-0"
  >
    <div class="flex max-h-[calc(100vh-6rem)] flex-col">
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
      >
        <h2 class="text-sm font-semibold leading-none">Map appearance</h2>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onclick={resetMapPreferences}
        >
          Reset
        </button>
      </div>

      <Tabs.Root
        bind:value={activeTab}
        class="min-h-0 flex-1 gap-0 overflow-hidden"
      >
        <div class="shrink-0 border-b px-3 py-2">
          <Tabs.List class="grid w-full grid-cols-3">
            <Tabs.Trigger value="map">Map</Tabs.Trigger>
            <Tabs.Trigger value="flights">Flights</Tabs.Trigger>
            <Tabs.Trigger value="layers">Layers</Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="map" class="min-h-0 overflow-y-auto">
          <MapAppearanceTab />
        </Tabs.Content>
        <Tabs.Content value="flights" class="min-h-0 overflow-y-auto">
          <FlightsAppearanceTab {showTracksSection} {hasFallbackArcs} />
        </Tabs.Content>
        <Tabs.Content value="layers" class="min-h-0 overflow-y-auto">
          <LayersAppearanceTab
            {openAipConfigured}
            {isAdmin}
            onOpenIntegrationSettings={openIntegrationSettings}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  </Popover.Content>
</Popover.Root>
