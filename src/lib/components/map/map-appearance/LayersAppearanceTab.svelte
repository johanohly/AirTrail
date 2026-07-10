<script lang="ts">
  import { Settings2 } from '@o7/icon/lucide';

  import AppearanceTile from '../AppearanceTile.svelte';
  import { OPENAIP_GROUP_OPTIONS } from '../map-appearance-options';

  import aptSymbol from '$lib/assets/openaip/symbols/apt-medium.svg';
  import navaidRoseSymbol from '$lib/assets/openaip/symbols/navaid_rose-medium.svg';
  import reportingPointSymbol from '$lib/assets/openaip/symbols/reporting_point_compulsory-medium.svg';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import {
    mapPreferences,
    toggleOpenAipGroup,
  } from '$lib/map/map-preferences.svelte';
  import { cn } from '$lib/utils';

  let {
    openAipConfigured = false,
    isAdmin = false,
    onOpenIntegrationSettings,
  }: {
    openAipConfigured?: boolean;
    isAdmin?: boolean;
    onOpenIntegrationSettings: () => void;
  } = $props();
</script>

<div class="divide-y divide-border/60">
  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Environment
    </h3>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium leading-none">Time of day</p>
        <p class="text-muted-foreground mt-1 text-[11px]">
          Live day/night shading
        </p>
      </div>
      <Switch
        size="small"
        checked={mapPreferences.timeOfDayEnabled}
        onCheckedChange={(value) => (mapPreferences.timeOfDayEnabled = value)}
      />
    </div>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium leading-none">Rain radar</p>
        <p class="text-muted-foreground mt-1 text-[11px]">
          Latest RainViewer precipitation
        </p>
      </div>
      <Switch
        size="small"
        checked={mapPreferences.rainViewerEnabled}
        onCheckedChange={(value) => (mapPreferences.rainViewerEnabled = value)}
      />
    </div>
  </section>

  {#if openAipConfigured}
    <section class="space-y-3 px-4 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h3
            class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
          >
            OpenAIP
          </h3>
          <p class="text-muted-foreground text-[11px]">
            Airspaces, airports, and navaids
          </p>
        </div>
        <Switch
          size="small"
          checked={mapPreferences.openAipEnabled}
          onCheckedChange={(value) => (mapPreferences.openAipEnabled = value)}
        />
      </div>
      <div
        class={cn(
          'grid grid-cols-3 gap-2 transition-opacity',
          !mapPreferences.openAipEnabled && 'pointer-events-none opacity-40',
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
                    stroke-dasharray="2 2"
                  />
                  <text
                    x="24"
                    y="16"
                    text-anchor="middle"
                    font-size="9"
                    font-weight="700"
                    fill="#6d28d9">CTR</text
                  >
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
      class="m-4 space-y-2 rounded-md border border-dashed bg-muted/40 p-3"
    >
      <div class="flex items-start gap-2">
        <Settings2
          class="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div class="space-y-0.5">
          <h3 class="text-sm font-semibold">OpenAIP overlay</h3>
          <p class="text-muted-foreground text-[11px] leading-snug">
            Add an OpenAIP API key in integration settings to enable airspaces,
            navaids, and reporting points.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="w-full"
        onclick={onOpenIntegrationSettings}
      >
        Open integration settings
      </Button>
    </section>
  {/if}
</div>
