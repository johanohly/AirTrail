<script lang="ts">
  import { mode } from 'mode-watcher';
  import { fly } from 'svelte/transition';
  import { base } from '$app/paths';

  import AppearanceTile from '../AppearanceTile.svelte';
  import {
    AIRPORT_DETAIL_OPTIONS,
    BASEMAP_OPTIONS,
    PROJECTION_OPTIONS,
  } from '../map-appearance-options';

  import { mapPreferences } from '$lib/map/map-preferences.svelte';

  const basemapPreviewTheme = $derived(
    mode.current === 'dark' ? 'dark' : 'light',
  );
  const airportDetailSupported = $derived(mapPreferences.basemap === 'default');
</script>

<div class="divide-y divide-border/60">
  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Basemap
    </h3>
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
        <h4
          class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
        >
          Airport detail
        </h4>
        <div class="grid grid-cols-2 gap-2">
          {#each AIRPORT_DETAIL_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.airportOverlayDetail === option.value}
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
                  <rect width="72" height="32" fill="var(--airport-ground)" />
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
                    />
                    {#if option.value === 'detailed'}
                      <path
                        d="M8 -5 V5 M-2 -4 V4 M0 -4 V4 M2 -4 V4 M4 -4 V4 M6 -4 V4"
                        fill="none"
                        stroke="var(--airport-runway-marking)"
                        stroke-width="0.75"
                      />
                    {/if}
                  </g>
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Projection
    </h3>
    <div class="grid grid-cols-2 gap-2">
      {#each PROJECTION_OPTIONS as option (option.value)}
        <AppearanceTile
          selected={mapPreferences.projection === option.value}
          onclick={() => (mapPreferences.projection = option.value)}
          label={option.label}
        >
          {#snippet illustration()}
            <svg viewBox="0 0 72 32" class="h-full w-full" aria-hidden="true">
              {#if option.value === 'mercator'}
                <g
                  fill="none"
                  stroke="currentColor"
                  stroke-width="0.75"
                  stroke-opacity="0.4"
                  class="text-muted-foreground"
                >
                  <path d="M14 4 V28 M25 4 V28 M36 4 V28 M47 4 V28 M58 4 V28" />
                  <path d="M6 10.5 H66 M6 21.5 H66" />
                </g>
                <path
                  d="M14 22 Q36 7 58 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  class="text-primary"
                />
              {:else}
                <g fill="none" stroke="currentColor">
                  <circle
                    cx="36"
                    cy="16"
                    r="13"
                    stroke-width="1"
                    stroke-opacity="0.6"
                    class="text-muted-foreground"
                  />
                  <ellipse
                    cx="36"
                    cy="16"
                    rx="6"
                    ry="13"
                    stroke-width="0.75"
                    stroke-opacity="0.4"
                    class="text-muted-foreground"
                  />
                  <path
                    d="M23 16 H49 M25 10 Q36 8 47 10 M25 22 Q36 24 47 22"
                    stroke-width="0.75"
                    stroke-opacity="0.4"
                    class="text-muted-foreground"
                  />
                  <path
                    d="M28 22.5 Q33 8 45.5 10"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    class="text-primary"
                  />
                </g>
              {/if}
            </svg>
          {/snippet}
        </AppearanceTile>
      {/each}
    </div>
  </section>
</div>

<style>
  .airport-detail-tile {
    --airport-ground: #eef2ef;
    --airport-taxiway-edge: #dfe3e1;
    --airport-taxiway: #fafafa;
    --airport-taxiway-centerline: #eab308;
    --airport-runway: #d9dadd;
    --airport-runway-edge: #c6c8cc;
    --airport-runway-marking: #fafafa;
  }

  :global(.dark) .airport-detail-tile {
    --airport-ground: #121a18;
    --airport-taxiway-edge: #24302d;
    --airport-taxiway: #33413d;
    --airport-taxiway-centerline: #facc15;
    --airport-runway: #3a3f46;
    --airport-runway-edge: #515966;
    --airport-runway-marking: #eef2f7;
  }
</style>
