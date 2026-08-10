<script lang="ts">
  import { fly } from 'svelte/transition';

  import AppearanceTile from '../AppearanceTile.svelte';
  import {
    AIRPORT_CIRCLE_OPTIONS,
    AIRPORT_CIRCLE_RADIUS_OPTIONS,
    ARC_COLOR_OPTIONS,
    ARC_SCALE_OPTIONS,
    ARC_THICKNESS_OPTIONS,
    FLIGHT_TRACK_STYLE_OPTIONS,
    ROUTE_DISPLAY_OPTIONS,
  } from '../map-appearance-options';

  import {
    FLIGHT_TRACK_ALTITUDE_COLOR_STOPS,
    FLIGHT_TRACK_MAX_ALTITUDE_FEET,
  } from '$lib/map/flight-track-style';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';

  let {
    showTracksSection = false,
    hasFallbackArcs = true,
  }: {
    showTracksSection?: boolean;
    hasFallbackArcs?: boolean;
  } = $props();

  const cssColor = (color: readonly number[]) =>
    `rgb(${color[0]} ${color[1]} ${color[2]})`;
</script>

<div class="divide-y divide-border/60">
  <section class="space-y-3 px-4 py-4">
    <h3
      class="text-muted-foreground text-[10px] font-medium uppercase tracking-wider"
    >
      Airports
    </h3>
    <div class="space-y-2">
      <p class="text-xs font-medium">Size</p>
      <div class="grid grid-cols-4 gap-2">
        {#each AIRPORT_CIRCLE_OPTIONS as option, index (option.value)}
          <AppearanceTile
            compact
            selected={mapPreferences.airportCircles === option.value}
            onclick={() => (mapPreferences.airportCircles = option.value)}
            label={option.label}
          >
            {#snippet illustration()}
              <svg
                viewBox="0 0 48 24"
                class="h-full w-full text-primary"
                aria-hidden="true"
              >
                {#if option.value === 'off'}
                  <path
                    d="M15 18 L33 6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="text-muted-foreground"
                  />
                {:else}
                  <circle
                    cx="24"
                    cy="12"
                    r={index === 1 ? 3 : index === 2 ? 6 : 9}
                    fill="currentColor"
                    fill-opacity="0.2"
                    stroke="currentColor"
                    stroke-width="1"
                  />
                {/if}
              </svg>
            {/snippet}
          </AppearanceTile>
        {/each}
      </div>
    </div>

    {#if mapPreferences.airportCircles !== 'off'}
      <div class="space-y-2" transition:fly={{ y: -8, duration: 160 }}>
        <p class="text-xs font-medium">Mode</p>
        <div class="grid grid-cols-2 gap-2">
          {#each AIRPORT_CIRCLE_RADIUS_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.airportCircleRadius === option.value}
              onclick={() =>
                (mapPreferences.airportCircleRadius = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                <svg
                  viewBox="0 0 72 32"
                  class="h-full w-full text-primary"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="20"
                    r={option.value === 'uniform' ? 5 : 3}
                    fill="currentColor"
                    fill-opacity="0.2"
                    stroke="currentColor"
                  />
                  <circle
                    cx="36"
                    cy="12"
                    r={option.value === 'uniform' ? 5 : 8}
                    fill="currentColor"
                    fill-opacity="0.2"
                    stroke="currentColor"
                  />
                  <circle
                    cx="54"
                    cy="21"
                    r={option.value === 'uniform' ? 5 : 4}
                    fill="currentColor"
                    fill-opacity="0.2"
                    stroke="currentColor"
                  />
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
      Routes
    </h3>

    {#if showTracksSection}
      <div class="space-y-2">
        <p class="text-xs font-medium">Tracks</p>
        <div class="grid grid-cols-2 gap-2">
          {#each ROUTE_DISPLAY_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.routeDisplay === option.value}
              onclick={() => (mapPreferences.routeDisplay = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                <svg
                  viewBox="0 0 72 32"
                  class="h-full w-full text-primary"
                  aria-hidden="true"
                >
                  {#if option.value === 'tracks'}
                    <path
                      d="M4 24 C12 16, 20 12, 28 14 S44 24, 52 18 S64 10, 68 8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  {:else}
                    <path
                      d="M4 24 Q36 2 68 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <path
                      d="M4 28 Q36 8 68 28"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  {/if}
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </div>
    {/if}

    {#if showTracksSection && mapPreferences.routeDisplay === 'tracks'}
      <div class="space-y-2">
        <p class="text-xs font-medium">Track style</p>
        <div class="grid grid-cols-2 gap-2">
          {#each FLIGHT_TRACK_STYLE_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.flightTrackStyle === option.value}
              onclick={() => (mapPreferences.flightTrackStyle = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                <svg
                  viewBox="0 0 72 32"
                  class="h-full w-full"
                  aria-hidden="true"
                >
                  {#if option.value === 'standard'}
                    <path
                      d="M4 23 C15 12, 24 14, 34 18 S51 20, 68 7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.25"
                      stroke-linecap="round"
                      class="text-primary"
                    />
                  {:else}
                    <defs>
                      <linearGradient
                        id="flight-track-altitude-preview"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        {#each FLIGHT_TRACK_ALTITUDE_COLOR_STOPS as stop (stop.at)}
                          <stop
                            offset={`${(stop.at / FLIGHT_TRACK_MAX_ALTITUDE_FEET) * 100}%`}
                            stop-color={cssColor(stop.color)}
                          />
                        {/each}
                      </linearGradient>
                    </defs>
                    <path
                      d="M4 23 C15 12, 24 14, 34 18 S51 20, 68 7"
                      fill="none"
                      stroke="url(#flight-track-altitude-preview)"
                      stroke-width="2.25"
                      stroke-linecap="round"
                    />
                  {/if}
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </div>
    {/if}

    <div class="space-y-2">
      <p class="text-xs font-medium">Width</p>
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
                {#each [0, 1, 2] as line (line)}
                  <path
                    d={`M4 ${22 + line * 3} Q36 ${2 + line * 6} 68 ${22 + line * 3}`}
                    fill="none"
                    stroke="currentColor"
                    stroke-width={option.value === 'uniform'
                      ? 1.75
                      : 3.5 - line * 1.2}
                    stroke-linecap="round"
                  />
                {/each}
              </svg>
            {/snippet}
          </AppearanceTile>
        {/each}
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-xs font-medium">Scale</p>
      <div class="grid grid-cols-3 gap-2">
        {#each ARC_SCALE_OPTIONS as option (option.value)}
          <AppearanceTile
            compact
            selected={mapPreferences.arcThicknessScale === option.value}
            onclick={() => (mapPreferences.arcThicknessScale = option.value)}
            label={option.label}
          >
            {#snippet illustration()}
              <svg
                viewBox="0 0 72 24"
                class="h-full w-full text-primary"
                aria-hidden="true"
              >
                <path
                  d="M4 20 Q36 0 68 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width={option.value === 'thin'
                    ? 1
                    : option.value === 'normal'
                      ? 2.25
                      : 4}
                  stroke-linecap="round"
                />
              </svg>
            {/snippet}
          </AppearanceTile>
        {/each}
      </div>
    </div>

    {#if mapPreferences.flightTrackStyle !== 'altitude' || !showTracksSection || mapPreferences.routeDisplay !== 'tracks' || hasFallbackArcs}
      <div class="space-y-2" transition:fly={{ y: -8, duration: 160 }}>
        <p class="text-xs font-medium">Color</p>
        <div class="grid grid-cols-2 gap-2">
          {#each ARC_COLOR_OPTIONS as option (option.value)}
            <AppearanceTile
              selected={mapPreferences.arcColor === option.value}
              onclick={() => (mapPreferences.arcColor = option.value)}
              label={option.label}
            >
              {#snippet illustration()}
                <svg
                  viewBox="0 0 72 32"
                  class="h-full w-full"
                  aria-hidden="true"
                >
                  {#each [0, 1, 2] as line (line)}
                    <path
                      d={`M4 ${22 + line * 3} Q36 ${2 + line * 6} 68 ${22 + line * 3}`}
                      fill="none"
                      stroke={option.value === 'default'
                        ? 'currentColor'
                        : line === 0
                          ? '#60a5fa'
                          : line === 1
                            ? '#a78bfa'
                            : '#ef4444'}
                      stroke-width="2"
                      stroke-linecap="round"
                      class={option.value === 'default' ? 'text-primary' : ''}
                    />
                  {/each}
                </svg>
              {/snippet}
            </AppearanceTile>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</div>
