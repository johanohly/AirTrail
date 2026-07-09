<script lang="ts">
  import { ChevronDown } from '@o7/icon/lucide';
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

  const mobile = new MediaQuery('(max-width: 639px)');
  const labelAltitudes = [0, 10_000, 20_000, 30_000, 40_000, 51_000];
  const cssColor = (color: readonly number[]) =>
    `rgb(${color[0]} ${color[1]} ${color[2]})`;
  const colorAt = (altitudeFeet: number | null, ground = false) =>
    cssColor(getFlightTrackColor({ altitudeFeet, ground }));
  const gradient = `linear-gradient(90deg in oklab, ${FLIGHT_TRACK_ALTITUDE_COLOR_STOPS.map(
    ({ at, color }) =>
      `${cssColor(color)} ${(at / FLIGHT_TRACK_MAX_ALTITUDE_FEET) * 100}%`,
  ).join(', ')})`;
  const estimatedColor = colorAt(20_000);
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
            Unknown
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="relative h-1 w-7" aria-hidden="true">
              <span class="absolute inset-x-0 top-[1px] h-px bg-zinc-900/70"
              ></span>
              <span
                class="absolute inset-0"
                style={`background: repeating-linear-gradient(90deg, ${estimatedColor} 0 5px, transparent 5px 9px)`}
              ></span>
            </span>
            Estimated
          </span>
        </div>
      </div>
    </details>
  </Control>
{/key}
