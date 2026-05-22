<script lang="ts">
  import { Settings2 } from '@o7/icon/lucide';
  import { mode } from 'mode-watcher';
  import { ControlButton } from 'svelte-maplibre';
  import { fly } from 'svelte/transition';
  import { base } from '$app/paths';
  import { page } from '$app/state';

  import AppearanceTile from './AppearanceTile.svelte';

  import aptSymbol from '$lib/assets/openaip/symbols/apt-medium.svg';
  import navaidRoseSymbol from '$lib/assets/openaip/symbols/navaid_rose-medium.svg';
  import reportingPointSymbol from '$lib/assets/openaip/symbols/reporting_point_compulsory-medium.svg';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import { Switch } from '$lib/components/ui/switch';
  import type { MapBasemap } from '$lib/map/basemap';
  import {
    mapPreferences,
    resetMapPreferences,
    toggleOpenAipGroup,
    type AirportOverlayDetail,
    type AirportCirclesMode,
    type ArcThicknessMode,
    type ArcThicknessScale,
  } from '$lib/map/map-preferences.svelte';
  import {
    OPENAIP_OVERLAY_GROUPS,
    type OpenAipOverlayGroup,
  } from '$lib/map/openaip';
  import { openModalsState } from '$lib/state.svelte';
  import { cn } from '$lib/utils';

  let { openAipConfigured = false }: { openAipConfigured?: boolean } = $props();

  let popoverOpen = $state(false);
  const isAdmin = $derived(page.data.user?.role !== 'user');

  const openIntegrationSettings = () => {
    popoverOpen = false;
    openModalsState.settingsTab = 'integrations';
    openModalsState.settings = true;
  };

  const AIRPORT_CIRCLE_OPTIONS: Array<{
    value: AirportCirclesMode;
    label: string;
  }> = [
    { value: 'off', label: 'Off' },
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  const ARC_THICKNESS_OPTIONS: Array<{
    value: ArcThicknessMode;
    label: string;
  }> = [
    { value: 'uniform', label: 'Uniform' },
    { value: 'byFrequency', label: 'By frequency' },
  ];

  const ARC_SCALE_OPTIONS: Array<{
    value: ArcThicknessScale;
    label: string;
  }> = [
    { value: 'thin', label: 'Thin' },
    { value: 'normal', label: 'Normal' },
    { value: 'thick', label: 'Thick' },
  ];

  const AIRPORT_DETAIL_OPTIONS: Array<{
    value: AirportOverlayDetail;
    label: string;
  }> = [
    { value: 'standard', label: 'Standard' },
    { value: 'detailed', label: 'Detailed' },
  ];

  const OPENAIP_GROUP_OPTIONS: Array<{
    value: OpenAipOverlayGroup;
    label: string;
  }> = [
    { value: 'airspaces', label: 'Airspaces' },
    { value: 'airspaceLabels', label: 'Airspace labels' },
    { value: 'airports', label: 'Airports' },
    { value: 'navaids', label: 'Navaids' },
    { value: 'reportingPoints', label: 'Reporting points' },
  ];

  // Sanity assertion: make sure we render a tile for every known group.
  OPENAIP_OVERLAY_GROUPS satisfies readonly OpenAipOverlayGroup[];

  const BASEMAP_OPTIONS: Array<{
    value: MapBasemap;
    label: string;
  }> = [
    { value: 'default', label: 'Default' },
    { value: 'satellite', label: 'Satellite' },
  ];

  const basemapPreviewTheme = $derived(
    mode.current === 'dark' ? 'dark' : 'light',
  );
  const airportDetailSupported = $derived(mapPreferences.basemap === 'default');
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
    class="w-[320px] p-0"
  >
    <div class="max-h-[calc(100vh-6rem)] overflow-y-auto p-4 space-y-5">
      <section class="space-y-2">
        <div class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold">Basemap</h3>
          <p class="text-muted-foreground text-[11px]">Style</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          {#each BASEMAP_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.basemap === option.value}
              onclick={() => (mapPreferences.basemap = option.value)}
              label={option.label}
              labelOutside
            >
              {#snippet illustration()}
                <img
                  src={option.value === 'satellite'
                    ? `${base}/basemap-previews/satellite.jpg`
                    : `${base}/basemap-previews/default-${basemapPreviewTheme}.png`}
                  alt=""
                  draggable="false"
                  class="size-full object-cover"
                />
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
        {#if airportDetailSupported}
          <div
            class="space-y-2 border-t pt-3"
            transition:fly={{ y: -8, duration: 160 }}
          >
            <div class="flex items-baseline justify-between">
              <h4 class="text-xs font-semibold">Airport detail</h4>
              <p class="text-muted-foreground text-[11px]">Overlay</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              {#each AIRPORT_DETAIL_OPTIONS as option (option.value)}
                <AppearanceTile
                  selected={mapPreferences.airportOverlayDetail ===
                    option.value}
                  onclick={() =>
                    (mapPreferences.airportOverlayDetail = option.value)}
                  label={option.label}
                >
                  {#snippet illustration()}
                    <svg
                      viewBox="0 0 72 32"
                      class="airport-detail-tile h-full w-full"
                      aria-hidden="true"
                    >
                      <rect
                        width="72"
                        height="32"
                        fill="var(--airport-ground)"
                      />
                      <g transform="translate(36 16) rotate(-53)">
                        <path
                          d="M10 -20 V42"
                          fill="none"
                          stroke="var(--airport-taxiway-edge)"
                          stroke-width="5"
                          stroke-linecap="round"
                        />
                        <path
                          d="M10 -20 V42"
                          fill="none"
                          stroke="var(--airport-taxiway)"
                          stroke-width="3.5"
                          stroke-linecap="round"
                        />
                        {#if option.value === 'detailed'}
                          <path
                            d="M10 -19 V41"
                            fill="none"
                            stroke="var(--airport-taxiway-centerline)"
                            stroke-width="0.8"
                            stroke-linecap="round"
                          />
                        {/if}
                        <rect
                          x="-36"
                          y="-5"
                          width="46"
                          height="10"
                          rx="1"
                          fill="var(--airport-runway)"
                          stroke="var(--airport-runway-edge)"
                          stroke-width="0.5"
                        />
                        <path
                          d="M-22 0 H2"
                          fill="none"
                          stroke="var(--airport-runway-marking)"
                          stroke-width="1.25"
                          stroke-dasharray="5 4"
                          stroke-linecap="round"
                          stroke-opacity="0.9"
                        />
                      </g>
                      {#if option.value === 'detailed'}
                        <g transform="translate(36 16) rotate(-53)">
                          <path
                            d="M8 -5 V5"
                            fill="none"
                            stroke="var(--airport-runway-marking)"
                            stroke-width="1"
                            stroke-linecap="round"
                          />
                          <path
                            d="M-2 -4 V4 M0 -4 V4 M2 -4 V4 M4 -4 V4 M6 -4 V4"
                            fill="none"
                            stroke="var(--airport-runway-marking)"
                            stroke-width="0.75"
                          />
                          <circle
                            cx="-30"
                            cy="-8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <circle
                            cx="-20"
                            cy="-8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <circle
                            cx="-10"
                            cy="-8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <circle
                            cx="-30"
                            cy="8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <circle
                            cx="-20"
                            cy="8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <circle
                            cx="-10"
                            cy="8"
                            r="1"
                            fill="var(--airport-edge-light)"
                          />
                          <path
                            d="M10 -5 L13 -6.5 L13 -3.5 Z"
                            fill="var(--airport-green-light)"
                          />
                          <path
                            d="M10 -5 L7 -6.5 L7 -3.5 Z"
                            fill="var(--airport-red-light)"
                          />
                          <path
                            d="M10 5 L13 3.5 L13 6.5 Z"
                            fill="var(--airport-green-light)"
                          />
                          <path
                            d="M10 5 L7 3.5 L7 6.5 Z"
                            fill="var(--airport-red-light)"
                          />
                        </g>
                      {/if}
                    </svg>
                  {/snippet}
                </AppearanceTile>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <section class="space-y-2">
        <div class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold">Airports</h3>
          <p class="text-muted-foreground text-[11px]">Circle size</p>
        </div>
        <div class="grid grid-cols-4 gap-2">
          {#each AIRPORT_CIRCLE_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.airportCircles === option.value}
              onclick={() => (mapPreferences.airportCircles = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                {#if option.value === 'off'}
                  <svg
                    viewBox="0 0 48 32"
                    class="h-full w-full text-muted-foreground"
                    aria-hidden="true"
                  >
                    <circle
                      cx="24"
                      cy="16"
                      r="6"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-dasharray="2 2"
                    />
                    <line
                      x1="14"
                      y1="6"
                      x2="34"
                      y2="26"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                {:else}
                  {@const radii =
                    option.value === 'small'
                      ? [2, 3, 2.5]
                      : option.value === 'medium'
                        ? [3.5, 5, 4]
                        : [5, 7.5, 6]}
                  <svg
                    viewBox="0 0 48 32"
                    class="h-full w-full text-primary"
                    aria-hidden="true"
                  >
                    <circle
                      cx="13"
                      cy="20"
                      r={radii[0]}
                      fill="currentColor"
                      fill-opacity="0.2"
                      stroke="currentColor"
                      stroke-width="1"
                    />
                    <circle
                      cx="26"
                      cy="13"
                      r={radii[1]}
                      fill="currentColor"
                      fill-opacity="0.2"
                      stroke="currentColor"
                      stroke-width="1"
                    />
                    <circle
                      cx="37"
                      cy="22"
                      r={radii[2]}
                      fill="currentColor"
                      fill-opacity="0.2"
                      stroke="currentColor"
                      stroke-width="1"
                    />
                  </svg>
                {/if}
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </section>

      <section class="space-y-2">
        <div class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold">Arcs</h3>
          <p class="text-muted-foreground text-[11px]">Thickness</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          {#each ARC_THICKNESS_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.arcThickness === option.value}
              onclick={() => (mapPreferences.arcThickness = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                <svg
                  viewBox="0 0 72 32"
                  class="h-full w-full text-primary"
                  aria-hidden="true"
                >
                  {#if option.value === 'uniform'}
                    <path
                      d="M4 24 Q36 2 68 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                    />
                    <path
                      d="M4 26 Q36 8 68 26"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                    />
                    <path
                      d="M4 28 Q36 14 68 28"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                    />
                  {:else}
                    <path
                      d="M4 24 Q36 2 68 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3.5"
                      stroke-linecap="round"
                    />
                    <path
                      d="M4 26 Q36 8 68 26"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <path
                      d="M4 28 Q36 14 68 28"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1"
                      stroke-linecap="round"
                    />
                  {/if}
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
        <div class="grid grid-cols-3 gap-2">
          {#each ARC_SCALE_OPTIONS as option (option.value)}
            <AppearanceTile
              compact
              selected={mapPreferences.arcThicknessScale === option.value}
              onclick={() => (mapPreferences.arcThicknessScale = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                {@const strokeWidth =
                  option.value === 'thin'
                    ? 1
                    : option.value === 'normal'
                      ? 2.25
                      : 4}
                <svg
                  viewBox="0 0 72 24"
                  class="h-full w-full text-primary"
                  aria-hidden="true"
                >
                  <path
                    d="M4 20 Q36 0 68 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width={strokeWidth}
                    stroke-linecap="round"
                  />
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </section>

      {#if openAipConfigured}
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold">OpenAIP overlay</h3>
              <p class="text-muted-foreground text-[11px]">
                Airspaces, airports, and navaids
              </p>
            </div>
            <Switch
              size="small"
              checked={mapPreferences.openAipEnabled}
              onCheckedChange={(v) => (mapPreferences.openAipEnabled = v)}
            />
          </div>
          <div
            class={cn(
              'grid grid-cols-3 gap-2 transition-opacity',
              !mapPreferences.openAipEnabled &&
                'pointer-events-none opacity-40',
            )}
            aria-hidden={!mapPreferences.openAipEnabled}
          >
            {#each OPENAIP_GROUP_OPTIONS as option (option.value)}
              <AppearanceTile
                compact
                selected={mapPreferences.openAipGroups.includes(option.value)}
                onclick={() => toggleOpenAipGroup(option.value)}
                label={option.label}
              >
                {#snippet illustration()}
                  {#if option.value === 'airspaces'}
                    <svg
                      viewBox="0 0 48 24"
                      class="h-full w-full"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 18 L14 6 L30 6 L42 14 L36 20 L10 20 Z"
                        fill="#8b5cf6"
                        fill-opacity="0.25"
                        stroke="#8b5cf6"
                        stroke-width="1.25"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M16 16 L22 10 L32 12 L30 18 Z"
                        fill="#3b82f6"
                        fill-opacity="0.3"
                        stroke="#3b82f6"
                        stroke-width="1"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {:else if option.value === 'airspaceLabels'}
                    <svg
                      viewBox="0 0 48 24"
                      class="h-full w-full"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 18 L12 6 L32 6 L42 14 L36 20 L9 20 Z"
                        fill="#8b5cf6"
                        fill-opacity="0.18"
                        stroke="#8b5cf6"
                        stroke-width="1"
                        stroke-linejoin="round"
                        stroke-dasharray="2 2"
                      />
                      <text
                        x="24"
                        y="16"
                        text-anchor="middle"
                        font-size="9"
                        font-weight="700"
                        font-family="ui-sans-serif, system-ui, sans-serif"
                        fill="#6d28d9"
                      >
                        CTR
                      </text>
                    </svg>
                  {:else if option.value === 'airports'}
                    <img
                      src={aptSymbol}
                      alt=""
                      class="h-[88%] w-auto dark:invert"
                    />
                  {:else if option.value === 'navaids'}
                    <img
                      src={navaidRoseSymbol}
                      alt=""
                      class="h-[92%] w-auto dark:invert"
                    />
                  {:else}
                    <img
                      src={reportingPointSymbol}
                      alt=""
                      class="h-[82%] w-auto dark:invert"
                    />
                  {/if}
                {/snippet}
              </AppearanceTile>
            {/each}
          </div>
        </section>
      {:else if isAdmin}
        <section
          class="rounded-md border border-dashed bg-muted/40 p-3 space-y-2"
        >
          <div class="flex items-start gap-2">
            <Settings2
              class="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div class="space-y-0.5">
              <h3 class="text-sm font-semibold">OpenAIP overlay</h3>
              <p class="text-muted-foreground text-[11px] leading-snug">
                Add an OpenAIP API key in integration settings to enable
                airspaces, navaids, and reporting points.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="w-full"
            onclick={openIntegrationSettings}
          >
            Open integration settings
          </Button>
        </section>
      {/if}

      <div class="flex justify-end border-t pt-3 -mx-4 px-4">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground text-xs font-medium"
          onclick={resetMapPreferences}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  </Popover.Content>
</Popover.Root>

<style>
  .airport-detail-tile {
    --airport-ground: #eef2ef;
    --airport-taxiway-edge: #dfe3e1;
    --airport-taxiway: #fafafa;
    --airport-taxiway-centerline: #eab308;
    --airport-runway: #d9dadd;
    --airport-runway-edge: #c6c8cc;
    --airport-runway-marking: #fafafa;
    --airport-edge-light: #9ca3af;
    --airport-green-light: #22c55e;
    --airport-red-light: #ef4444;
  }

  :global(.dark) .airport-detail-tile {
    --airport-ground: #121a18;
    --airport-taxiway-edge: #24302d;
    --airport-taxiway: #33413d;
    --airport-taxiway-centerline: #facc15;
    --airport-runway: #3a3f46;
    --airport-runway-edge: #515966;
    --airport-runway-marking: #eef2f7;
    --airport-edge-light: #94a3b8;
    --airport-green-light: #4ade80;
    --airport-red-light: #f87171;
  }
</style>
