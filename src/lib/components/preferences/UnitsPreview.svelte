<script lang="ts">
  import { Gauge, Thermometer, Ruler, Wind } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    convertDistance,
    convertPressure,
    convertTemperature,
    convertWindSpeed,
    distanceUnitLabel,
    getPreferences,
    pressureUnitLabel,
    temperatureUnitLabel,
    windSpeedUnitLabel,
  } from '$lib/utils/preferences';

  const prefs = $derived(getPreferences(page.data.user));

  // Recognisable, non-trivial sample values.
  const SAMPLE_KM = 5570; // ~JFK→LHR great-circle
  const SAMPLE_KT = 18;
  const SAMPLE_C = 21;
  const SAMPLE_HPA = 1013;

  const distance = $derived({
    value: Math.round(convertDistance(SAMPLE_KM, prefs)).toLocaleString(),
    unit: distanceUnitLabel(prefs),
  });
  const wind = $derived({
    value: Math.round(convertWindSpeed(SAMPLE_KT, prefs)).toString(),
    unit: windSpeedUnitLabel(prefs),
  });
  const temp = $derived({
    value: Math.round(convertTemperature(SAMPLE_C, prefs)).toString(),
    unit: temperatureUnitLabel(prefs),
  });
  const pressure = $derived({
    value:
      prefs.pressureUnit === 'inhg'
        ? convertPressure(SAMPLE_HPA, prefs).toFixed(2)
        : Math.round(convertPressure(SAMPLE_HPA, prefs)).toString(),
    unit: pressureUnitLabel(prefs),
  });
</script>

<div
  class="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3"
>
  <div
    class="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none"
  >
    Preview
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Ruler size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Distance
        </div>
        <div class="flex items-baseline gap-1 truncate">
          <span class="text-sm font-semibold tabular-nums">
            {distance.value}
          </span>
          <span class="text-xs text-muted-foreground">{distance.unit}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Wind size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Wind
        </div>
        <div class="flex items-baseline gap-1 truncate">
          <span class="text-sm font-semibold tabular-nums">{wind.value}</span>
          <span class="text-xs text-muted-foreground">{wind.unit}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Thermometer size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Temperature
        </div>
        <div class="flex items-baseline gap-0.5 truncate">
          <span class="text-sm font-semibold tabular-nums">{temp.value}</span>
          <span class="text-xs text-muted-foreground">{temp.unit}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Gauge size={14} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
          Pressure
        </div>
        <div class="flex items-baseline gap-1 truncate">
          <span class="text-sm font-semibold tabular-nums">
            {pressure.value}
          </span>
          <span class="text-xs text-muted-foreground">{pressure.unit}</span>
        </div>
      </div>
    </div>
  </div>
</div>
