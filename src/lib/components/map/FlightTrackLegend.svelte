<script lang="ts">
  import { ChevronDown } from '@o7/icon/lucide';
  import { mode } from 'mode-watcher';
  import { MediaQuery } from 'svelte/reactivity';
  import { Control } from 'svelte-maplibre';

  import { page } from '$app/state';
  import {
    FLIGHT_TRACK_ALTITUDE_COLOR_STOPS,
    FLIGHT_TRACK_MAX_ALTITUDE_FEET,
    getFlightTrackColor,
  } from '$lib/map/flight-track-style';
  import {
    altitudeUnitLabel,
    convertAltitude,
    getPreferences,
  } from '$lib/utils/preferences';

  const mobile = new MediaQuery('(max-width: 767px)');
  const labelAltitudes = [0, 10_000, 20_000, 30_000, 40_000, 51_000];
  const cssColor = (color: ArrayLike<number>) =>
    `rgb(${color[0]} ${color[1]} ${color[2]})`;
  const darkMode = $derived(mode.current === 'dark');
  const colorAt = (altitudeFeet: number | null, ground = false) =>
    cssColor(getFlightTrackColor({ altitudeFeet, ground, darkMode }));
  const gradient = `linear-gradient(90deg in oklab, ${FLIGHT_TRACK_ALTITUDE_COLOR_STOPS.map(
    ({ at, color }) =>
      `${cssColor(color)} ${(at / FLIGHT_TRACK_MAX_ALTITUDE_FEET) * 100}%`,
  ).join(', ')})`;
  const estimatedColor = $derived(
    cssColor(
      getFlightTrackColor({
        altitudeFeet: 20_000,
        ground: false,
        estimated: true,
        darkMode,
      }),
    ),
  );
  const prefs = $derived(getPreferences(page.data.user));
  const unit = $derived(altitudeUnitLabel(prefs));
  const labels = $derived(
    labelAltitudes.map((altitude, index) => {
      if (altitude === 0) return '0';
      const value = Math.round(convertAltitude(altitude, prefs) / 1_000);
      return `${value}k${index === labelAltitudes.length - 1 ? '+' : ''}`;
    }),
  );
</script>

{#key mobile.current}
  <Control
    position={mobile.current ? 'top-left' : 'bottom-left'}
    defaultStyling={false}
  >
    <details
      class="group maplibregl-ctrl overflow-hidden rounded-md border border-border/70 bg-background/92 text-foreground shadow-sm"
    >
      <summary
        class="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 select-none [&::-webkit-details-marker]:hidden"
        aria-label="Toggle flight track altitude legend"
      >
        <span
          class="h-1.5 w-10 rounded-full"
          style:background={gradient}
          aria-hidden="true"
        ></span>
        <span class="text-[10px] font-semibold uppercase tracking-wide"
          >Altitude</span
        >
        <ChevronDown
          size={13}
          class="text-muted-foreground transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div
        class="w-[min(18rem,calc(100vw-1.25rem))] border-t border-border/60 px-3 pt-2 pb-2.5"
        aria-label="Flight track altitude legend"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide">
            Altitude
          </p>
          <p class="text-muted-foreground text-[9px]">{unit}</p>
        </div>
        <div
          class="mt-1.5 h-1.5 rounded-full"
          style:background={gradient}
        ></div>
        <div
          class="text-muted-foreground relative mt-1 h-3 text-[9px] tabular-nums"
          aria-hidden="true"
        >
          {#each labels as label, index (labelAltitudes[index])}
            <span
              class="absolute top-0 {index === 0
                ? ''
                : index === labels.length - 1
                  ? '-translate-x-full'
                  : '-translate-x-1/2'}"
              style:left={`${(labelAltitudes[index]! / FLIGHT_TRACK_MAX_ALTITUDE_FEET) * 100}%`}
              >{label}</span
            >
          {/each}
        </div>
        <div
          class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"
        >
          <span class="inline-flex items-center gap-1.5">
            <span
              class="size-2 rounded-full"
              style:background-color={colorAt(null, true)}
            ></span>
            Ground
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span
              class="size-2 rounded-full"
              style:background-color={colorAt(null)}
            ></span>
            No altitude
          </span>
          <span class="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 36 10" class="h-2.5 w-9" aria-hidden="true">
              <path
                d="M2 5 H34"
                fill="none"
                stroke="rgb(24 24 27)"
                stroke-opacity="0.75"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M2 5 H34"
                fill="none"
                stroke={estimatedColor}
                stroke-width="4"
                stroke-dasharray="5 8.5"
                stroke-linecap="round"
              />
            </svg>
            Estimated
          </span>
        </div>
      </div>
    </details>
  </Control>
{/key}
