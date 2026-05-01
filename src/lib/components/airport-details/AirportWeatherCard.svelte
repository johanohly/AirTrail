<script lang="ts">
  import {
    ChevronDown,
    Cloud,
    CloudOff,
    CloudSun,
    Eye,
    Moon,
    Sun,
    Wind,
  } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { writable } from 'svelte/store';
  import { slide } from 'svelte/transition';

  import { page } from '$app/state';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import {
    convertTemperature,
    convertWindSpeed,
    getPreferences,
    temperatureUnitLabel,
    windSpeedUnitLabel,
  } from '$lib/utils/preferences';
  import type { CloudLayer, FlightCategory } from '$lib/zod/metar';

  const prefs = $derived(getPreferences(page.data.user));

  let {
    icao,
    tz,
    lon,
  }: { icao: string; tz?: string | null; lon?: number | null } = $props();

  const icaoStore = writable(icao);
  $effect(() => {
    icaoStore.set(icao);
  });

  const metarQuery = trpc.weather.getMetar.query(icaoStore, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const metar = $derived($metarQuery.data ?? null);
  const isLoading = $derived($metarQuery.isLoading);

  let expanded = $state(false);

  const CATEGORY_META: Record<
    FlightCategory,
    { label: string; color: string; bg: string; index: number }
  > = {
    LIFR: {
      label: 'Low IFR',
      color: 'text-fuchsia-500',
      bg: 'bg-fuchsia-500',
      index: 0,
    },
    IFR: { label: 'IFR', color: 'text-rose-500', bg: 'bg-rose-500', index: 1 },
    MVFR: {
      label: 'Marginal VFR',
      color: 'text-blue-500',
      bg: 'bg-blue-500',
      index: 2,
    },
    VFR: {
      label: 'Visual Flight Rules',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500',
      index: 3,
    },
  };

  const categoryOrder: FlightCategory[] = ['LIFR', 'IFR', 'MVFR', 'VFR'];

  const cloudOrder = ['SKC', 'FEW', 'SCT', 'BKN', 'OVC'] as const;
  type Coverage = (typeof cloudOrder)[number];

  function worstCoverage(clouds: CloudLayer[]): Coverage {
    return clouds.reduce<Coverage>((acc, c) => {
      return cloudOrder.indexOf(c.coverage) > cloudOrder.indexOf(acc)
        ? (c.coverage as Coverage)
        : acc;
    }, 'SKC');
  }

  const cloudCeiling = $derived.by<number | null>(() => {
    if (!metar) return null;
    if (metar.verticalVisibilityFt !== null) return metar.verticalVisibilityFt;
    const layer = metar.clouds.find(
      (c) => c.coverage === 'BKN' || c.coverage === 'OVC',
    );
    return layer?.baseFt ?? null;
  });

  const ceilingCategory: FlightCategory = $derived.by(() => {
    if (cloudCeiling === null) return 'VFR';
    if (cloudCeiling < 500) return 'LIFR';
    if (cloudCeiling < 1000) return 'IFR';
    if (cloudCeiling < 3000) return 'MVFR';
    return 'VFR';
  });

  const visibilityCategory: FlightCategory = $derived.by(() => {
    if (!metar) return 'VFR';
    if (metar.cavok) return 'VFR';
    const m = metar.visibilityM;
    if (m < 1600) return 'LIFR';
    if (m < 4800) return 'IFR';
    if (m < 8000) return 'MVFR';
    return 'VFR';
  });

  const conditionLabel = $derived.by(() => {
    if (!metar) return '';
    if (metar.cavok && metar.clouds.length === 0) return 'Clear';
    const worst = worstCoverage(metar.clouds);
    return {
      SKC: 'Clear',
      FEW: 'Mostly Clear',
      SCT: 'Partly Cloudy',
      BKN: 'Mostly Cloudy',
      OVC: 'Overcast',
    }[worst];
  });

  const localHour = $derived.by(() => {
    if (!metar) return 12;
    const observed = new Date(metar.observedAtIso);
    if (tz) {
      try {
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        });
        return parseInt(fmt.format(observed));
      } catch {
        // fall through to lon-based estimate
      }
    }
    if (typeof lon === 'number') {
      const utcH = observed.getUTCHours() + observed.getUTCMinutes() / 60;
      return (((utcH + lon / 15) % 24) + 24) % 24;
    }
    return observed.getUTCHours();
  });

  const isDaytime = $derived(localHour >= 6 && localHour < 19);

  const ConditionIcon = $derived.by(() => {
    if (!metar) return Sun;
    if (!isDaytime) return Moon;
    const worst = worstCoverage(metar.clouds);
    if (worst === 'SKC' || worst === 'FEW') return Sun;
    if (worst === 'OVC' || worst === 'BKN') return Cloud;
    return CloudSun;
  });

  const visibilityLabel = $derived.by(() => {
    if (!metar) return '';
    if (metar.cavok || metar.visibilityM >= 9999) return '10+ km';
    return `${(metar.visibilityM / 1000).toFixed(1)} km`;
  });

  const ceilingLabel = $derived(
    cloudCeiling === null ? 'None' : `${cloudCeiling.toLocaleString()} ft`,
  );

  const observedAgo = $derived.by(() => {
    if (!metar) return '';
    const observed = new Date(metar.observedAtIso).getTime();
    const diffMin = Math.max(0, Math.round((Date.now() - observed) / 60_000));
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    return `${h}h ${diffMin % 60}m ago`;
  });

  const category = $derived(
    metar ? CATEGORY_META[metar.flightCategory] : CATEGORY_META.VFR,
  );

  const compassRotation = $derived(metar?.wind.dirDeg ?? 0);
  const isVariableWind = $derived(metar?.wind.dirDeg === null);
  const needleDown = $derived.by(() => {
    if (!metar || metar.wind.dirDeg === null) return false;
    const d = metar.wind.dirDeg;
    return d > 135 && d < 225;
  });
  const cardinal = $derived.by(() => {
    if (!metar || metar.wind.dirDeg === null) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(metar.wind.dirDeg / 45) % 8];
  });

  const TICK_DEGS = [
    0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270,
    292.5, 315, 337.5,
  ];

  function angDist(a: number, b: number): number {
    return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  }

  const lit = $derived.by(() => {
    const def = { N: false, E: false, S: false, W: false };
    if (!metar || metar.wind.dirDeg === null) return def;
    const dir = metar.wind.dirDeg;
    return {
      N: angDist(dir, 0) < 90,
      E: angDist(dir, 90) < 90,
      S: angDist(dir, 180) < 90,
      W: angDist(dir, 270) < 90,
    };
  });

  const WIND_SCALE_MAX = 30;
  const WIND_TICK_COUNT = 27;
  const WIND_TICK_INDICES = Array.from(
    { length: WIND_TICK_COUNT },
    (_, i) => i,
  );
  const WIND_GRADIENT =
    'linear-gradient(to right, rgb(83, 177, 253) 0%, rgb(22, 179, 100) 45%, rgb(247, 144, 9) 55%, rgb(240, 68, 56) 75%, rgb(180, 35, 24) 95%)';

  type WindLevel = 'Calm' | 'Light' | 'Moderate' | 'Strong' | 'Storm';
  const WIND_META: Record<WindLevel, { label: string; bg: string }> = {
    Calm: { label: 'Calm', bg: 'bg-sky-500' },
    Light: { label: 'Light', bg: 'bg-emerald-500' },
    Moderate: { label: 'Moderate', bg: 'bg-amber-500' },
    Strong: { label: 'Strong', bg: 'bg-orange-500' },
    Storm: { label: 'Storm', bg: 'bg-rose-500' },
  };
  function levelFor(kt: number): WindLevel {
    if (kt <= 3) return 'Calm';
    if (kt <= 10) return 'Light';
    if (kt <= 21) return 'Moderate';
    if (kt <= 33) return 'Strong';
    return 'Storm';
  }

  function formatTemp(t: number | null): string {
    if (t === null) return '—';
    return `${Math.round(convertTemperature(t, prefs))}`;
  }
</script>

{#snippet windStrengthBar(kt: number, label: string)}
  {@const lvl = levelFor(kt)}
  {@const litCount = Math.round(
    Math.min(1, kt / WIND_SCALE_MAX) * WIND_TICK_COUNT,
  )}
  <div>
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span class="text-xs font-semibold tabular-nums">
        {Math.round(convertWindSpeed(kt, prefs))}<span
          class="text-muted-foreground font-normal"
        >
          {windSpeedUnitLabel(prefs)} · {WIND_META[lvl].label}</span
        >
      </span>
    </div>
    <div class="flex gap-0.5 mt-1.5">
      {#each WIND_TICK_INDICES as i}
        {@const isLit = i < litCount}
        <div
          class={cn(
            'h-3 flex-1 rounded-sm',
            !isLit && 'bg-muted-foreground/20',
          )}
          style:background-image={isLit ? WIND_GRADIENT : undefined}
          style:background-size={isLit
            ? `${WIND_TICK_COUNT * 100}% 100%`
            : undefined}
          style:background-position={isLit
            ? `${(i / (WIND_TICK_COUNT - 1)) * 100}% 0`
            : undefined}
        ></div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet categoryBar(active: FlightCategory)}
  {@const activeMeta = CATEGORY_META[active]}
  {@const markerLeft = ((activeMeta.index + 1) / categoryOrder.length) * 100}
  <div class="mt-1.5">
    <div class="relative flex items-center gap-1">
      {#each categoryOrder as cat}
        {@const meta = CATEGORY_META[cat]}
        {@const isActive = cat === active}
        <div
          class={cn(
            'h-1 flex-1 rounded-full',
            meta.bg,
            !isActive && 'opacity-25',
          )}
        ></div>
      {/each}
    </div>
    <div class="relative h-3.5 mt-0.5">
      <span
        class={cn(
          'absolute -translate-x-full text-[10px] font-semibold uppercase',
          activeMeta.color,
        )}
        style="left: {markerLeft}%"
      >
        {active}
      </span>
    </div>
  </div>
{/snippet}

<section class="px-4 py-4">
  <button
    type="button"
    class="flex w-full items-center justify-between gap-3 text-left"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
  >
    <h3 class="text-xs uppercase tracking-wider text-muted-foreground">
      Weather
    </h3>
    <div class="flex items-center gap-2 min-w-0">
      {#if !expanded}
        {#if metar}
          <span class="text-xs text-muted-foreground truncate">
            <span class="text-foreground font-medium tabular-nums">
              {formatTemp(metar.tempC)}{temperatureUnitLabel(prefs)}
            </span>
            <span class="text-muted-foreground/80"> · {conditionLabel}</span>
          </span>
          <ConditionIcon
            size={14}
            class={cn(
              'shrink-0',
              isDaytime ? 'text-amber-400' : 'text-slate-400',
            )}
          />
        {:else if isLoading}
          <span class="text-xs text-muted-foreground">Loading…</span>
        {:else}
          <span
            class="text-xs text-muted-foreground inline-flex items-center gap-1"
          >
            <CloudOff size={12} /> Unavailable
          </span>
        {/if}
      {/if}
      <ChevronDown
        size={14}
        class={cn(
          'shrink-0 text-muted-foreground transition-transform',
          expanded && 'rotate-180',
        )}
      />
    </div>
  </button>

  {#if expanded}
    <div transition:slide={{ duration: 200 }} class="pt-3">
      {#if isLoading && !metar}
        <div class="animate-pulse">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="space-y-2">
              <div class="h-9 w-24 rounded-md bg-muted"></div>
              <div class="h-3 w-20 rounded bg-muted/70"></div>
            </div>
            <div class="h-12 w-12 rounded-full bg-muted"></div>
          </div>
          <div
            class="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
          >
            <div class="flex items-center gap-2">
              <div class="h-4 w-10 rounded bg-muted"></div>
              <div class="h-3.5 w-28 rounded bg-muted/70"></div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-3">
              <div class="space-y-2">
                <div class="h-3 w-20 rounded bg-muted/70"></div>
                <div class="h-4 w-16 rounded bg-muted"></div>
                <div class="flex gap-1">
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                </div>
              </div>
              <div class="space-y-2">
                <div class="h-3 w-20 rounded bg-muted/70"></div>
                <div class="h-4 w-16 rounded bg-muted"></div>
                <div class="flex gap-1">
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                  <div class="h-1 flex-1 rounded-full bg-muted"></div>
                </div>
              </div>
            </div>
          </div>
          <div
            class="mt-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 flex items-center gap-4"
          >
            <div class="size-24 rounded-full bg-muted shrink-0"></div>
            <div class="flex-1 space-y-2.5">
              <div class="h-3 w-16 rounded bg-muted/70"></div>
              <div class="h-4 w-24 rounded bg-muted"></div>
              <div class="h-3 w-full rounded bg-muted/70"></div>
            </div>
          </div>
          <div class="h-2.5 w-32 rounded bg-muted/70 mt-4"></div>
        </div>
      {:else if !metar}
        <div class="flex items-center gap-2 text-muted-foreground">
          <CloudOff size={18} />
          <span class="text-sm">Weather unavailable for {icao}</span>
        </div>
      {:else}
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex items-baseline gap-1">
              <span class="text-4xl font-semibold leading-none tracking-tight">
                {formatTemp(metar.tempC)}
              </span>
              <span class="text-xl font-medium text-muted-foreground">
                {temperatureUnitLabel(prefs)}
              </span>
            </div>
            <p class="text-sm text-muted-foreground mt-1">{conditionLabel}</p>
          </div>
          <ConditionIcon
            size={48}
            class={cn(
              'shrink-0',
              isDaytime ? 'text-amber-400' : 'text-slate-400',
            )}
          />
        </div>

        <div
          class="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
        >
          <div class="flex items-center gap-2">
            <span
              class={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded text-white',
                category.bg,
              )}
            >
              {metar.flightCategory}
            </span>
            <span class={cn('text-sm font-medium', category.color)}>
              {category.label}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-3">
            <div>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Cloud size={13} />
                <span class="text-xs">Cloud Ceiling</span>
              </div>
              <p class="text-base font-semibold mt-0.5">{ceilingLabel}</p>
              {@render categoryBar(ceilingCategory)}
            </div>
            <div>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Eye size={13} />
                <span class="text-xs">Visibility</span>
              </div>
              <p class="text-base font-semibold mt-0.5">{visibilityLabel}</p>
              {@render categoryBar(visibilityCategory)}
            </div>
          </div>
        </div>

        <div
          class="mt-4 rounded-lg border border-border/60 bg-background/40 px-3 py-3"
        >
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <Wind size={13} />
            <span class="text-xs">Wind</span>
          </div>
          <div class="mt-2 flex items-center gap-4">
            <div class="relative shrink-0 size-24">
              <svg viewBox="0 0 96 96" class="size-24">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  fill="none"
                  class="stroke-border"
                  stroke-width="1"
                />
                {#each TICK_DEGS as deg}
                  {@const isCardinal = deg % 90 === 0}
                  <line
                    x1="48"
                    y1="6"
                    x2="48"
                    y2={isCardinal ? 12 : 9}
                    class={isCardinal
                      ? 'stroke-muted-foreground/70'
                      : 'stroke-muted-foreground/30'}
                    stroke-width={isCardinal ? 1.25 : 0.75}
                    transform="rotate({deg} 48 48)"
                  />
                {/each}
                <text
                  x="48"
                  y="20"
                  text-anchor="middle"
                  class={lit.N ? 'fill-foreground' : 'fill-muted-foreground/60'}
                  font-size="8"
                  font-weight={lit.N ? '900' : '700'}
                  letter-spacing="0.5">N</text
                >
                <text
                  x="78"
                  y="51"
                  text-anchor="middle"
                  class={lit.E ? 'fill-foreground' : 'fill-muted-foreground/60'}
                  font-size="8"
                  font-weight={lit.E ? '900' : '700'}>E</text
                >
                <text
                  x="48"
                  y="83"
                  text-anchor="middle"
                  class={lit.S ? 'fill-foreground' : 'fill-muted-foreground/60'}
                  font-size="8"
                  font-weight={lit.S ? '900' : '700'}>S</text
                >
                <text
                  x="18"
                  y="51"
                  text-anchor="middle"
                  class={lit.W ? 'fill-foreground' : 'fill-muted-foreground/60'}
                  font-size="8"
                  font-weight={lit.W ? '900' : '700'}>W</text
                >

                {#if metar.wind.varies}
                  {@const start = metar.wind.varies.from}
                  {@const end = metar.wind.varies.to}
                  {@const sweep = (end - start + 360) % 360 || 360}
                  {@const startRad = ((start - 90) * Math.PI) / 180}
                  {@const endRad = ((end - 90) * Math.PI) / 180}
                  {@const r = 38}
                  {@const x1 = 48 + r * Math.cos(startRad)}
                  {@const y1 = 48 + r * Math.sin(startRad)}
                  {@const x2 = 48 + r * Math.cos(endRad)}
                  {@const y2 = 48 + r * Math.sin(endRad)}
                  <path
                    d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`}
                    fill="none"
                    class="stroke-primary/40"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                {/if}

                {#if !isVariableWind}
                  <g
                    style="transform: rotate({compassRotation}deg); transform-origin: 48px 48px; transform-box: view-box; transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);"
                  >
                    <polygon points="48,14 45,48 51,48" class="fill-primary" />
                  </g>
                  <circle cx="48" cy="48" r="2.5" class="fill-primary" />
                {:else}
                  <circle cx="48" cy="48" r="3" class="fill-primary/60" />
                {/if}
              </svg>
              <div class="absolute inset-0 pointer-events-none">
                <span
                  class={cn(
                    'absolute inset-x-0 text-center text-[11px] font-medium tabular-nums text-muted-foreground leading-none transition-all duration-300',
                    needleDown ? 'top-7' : 'bottom-6',
                  )}
                >
                  {#if isVariableWind}VRB{:else}{String(
                      metar.wind.dirDeg,
                    ).padStart(3, '0')}°{/if}
                </span>
              </div>
            </div>
            <div class="flex-1 min-w-0 space-y-2.5">
              {#if metar.wind.gustKt !== null}
                {@render windStrengthBar(metar.wind.speedKt, 'Strength')}
                {@render windStrengthBar(metar.wind.gustKt, 'Gust')}
              {:else}
                <div>
                  <div
                    class="text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    Direction
                  </div>
                  <div class="text-sm font-semibold">
                    {#if isVariableWind}
                      Variable
                    {:else if metar.wind.varies}
                      {metar.wind.varies.from}° – {metar.wind.varies.to}°
                    {:else}
                      {cardinal}
                      <span class="text-xs font-normal text-muted-foreground">
                        · {metar.wind.dirDeg}°
                      </span>
                    {/if}
                  </div>
                </div>
                {@render windStrengthBar(metar.wind.speedKt, 'Strength')}
              {/if}
            </div>
          </div>
        </div>

        <TextTooltip
          content={metar.raw}
          rootProps={{ delayDuration: 0 }}
          contentProps={{ class: 'max-w-[90vw] font-mono text-xs' }}
        >
          <button
            type="button"
            onclick={async () => {
              try {
                await navigator.clipboard.writeText(metar.raw);
                toast.success('METAR copied');
              } catch {
                toast.error('Failed to copy');
              }
            }}
            class="text-[10px] uppercase tracking-wider text-muted-foreground mt-4 cursor-pointer underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 hover:text-foreground transition-colors"
          >
            METAR reported {observedAgo}
          </button>
        </TextTooltip>
      {/if}
    </div>
  {/if}
</section>
