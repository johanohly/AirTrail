<script lang="ts">
  import { Control } from 'svelte-maplibre';

  import { getFlightTrackColor } from '$lib/map/flight-track-style';
  import { mapPreferences } from '$lib/map/map-preferences.svelte';

  const gradientAltitudes = [0, 10_000, 20_000, 30_000, 40_000, 51_000];
  const cssColor = (color: readonly number[]) =>
    `rgb(${color[0]} ${color[1]} ${color[2]})`;
  const colorAt = (altitudeFeet: number | null, ground = false) =>
    cssColor(
      getFlightTrackColor({
        altitudeFeet,
        ground,
        palette: mapPreferences.flightTrackPalette,
      }),
    );
  const gradient = $derived(
    `linear-gradient(90deg, ${gradientAltitudes
      .map((altitude) => `${colorAt(altitude)} ${(altitude / 51_000) * 100}%`)
      .join(', ')})`,
  );
  const estimatedColor = $derived(colorAt(20_000));
</script>

<Control position="bottom-left">
  <div
    class="maplibregl-ctrl mb-8! w-[min(18rem,calc(100vw-5rem))] rounded-md border border-border/70 bg-background/92 px-3 py-2 text-foreground shadow-sm sm:mb-0!"
    aria-label="Flight track altitude legend"
  >
    <div class="flex items-center justify-between gap-2">
      <p class="text-[10px] font-semibold uppercase tracking-wide">Altitude</p>
      <p class="text-muted-foreground text-[9px]">feet</p>
    </div>
    <div class="mt-1.5 h-1.5 rounded-full" style:background={gradient}></div>
    <div
      class="text-muted-foreground mt-1 flex justify-between text-[9px] tabular-nums"
      aria-hidden="true"
    >
      <span>0</span>
      <span>10k</span>
      <span>20k</span>
      <span>30k</span>
      <span>40k+</span>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span class="inline-flex items-center gap-1.5">
        <span
          class="size-2 rounded-full"
          style:background-color={colorAt(null, true)}
        ></span>
        Ground
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full" style:background-color={colorAt(null)}
        ></span>
        Unknown
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="relative h-1 w-7" aria-hidden="true">
          <span class="absolute inset-x-0 top-[1px] h-px bg-zinc-900/70"></span>
          <span
            class="absolute inset-0"
            style={`background: repeating-linear-gradient(90deg, ${estimatedColor} 0 5px, transparent 5px 9px)`}
          ></span>
        </span>
        Estimated
      </span>
    </div>
  </div>
</Control>
