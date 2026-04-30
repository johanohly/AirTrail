<script lang="ts">
  import { Moon, Sun } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import { cn } from '$lib/utils';
  import {
    formatTime,
    getPreferences,
  } from '$lib/utils/preferences';

  let { tz }: { tz?: string | null } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
  });

  const resolvedTz = $derived(tz ?? 'UTC');

  const localTime = $derived(formatTime(now, prefs, resolvedTz));

  const localDateLabel = $derived(
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: resolvedTz,
    }).format(now),
  );

  const offsetLabel = $derived.by(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: resolvedTz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now);
      const tzn = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
      // "GMT+1" → "UTC+1"; "GMT" → "UTC"
      return tzn.replace(/^GMT/, 'UTC').replace(/^UTC$/, 'UTC+0');
    } catch {
      return 'UTC+0';
    }
  });

  const tzCityLabel = $derived(resolvedTz.split('/').slice(-1)[0].replace(/_/g, ' '));

  const localHour = $derived.by(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: resolvedTz,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(fmt.format(now));
    } catch {
      return now.getUTCHours();
    }
  });
  const isDaytime = $derived(localHour >= 6 && localHour < 19);

  const userOffsetMinutes = $derived.by(() => {
    try {
      const fmtAirport = new Intl.DateTimeFormat('en-US', {
        timeZone: resolvedTz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const fmtLocal = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parse = (s: string) => {
        const [h, m] = s.split(':').map((x) => parseInt(x.trim(), 10));
        return h * 60 + m;
      };
      let diff = parse(fmtAirport.format(now)) - parse(fmtLocal.format(now));
      // Normalize across midnight
      if (diff > 12 * 60) diff -= 24 * 60;
      if (diff < -12 * 60) diff += 24 * 60;
      return diff;
    } catch {
      return 0;
    }
  });

  const deltaLabel = $derived.by(() => {
    const m = userOffsetMinutes;
    if (m === 0) return 'Same as your time';
    const abs = Math.abs(m);
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (min > 0) parts.push(`${min}m`);
    const direction = m > 0 ? 'ahead of you' : 'behind you';
    return `${parts.join(' ')} ${direction}`;
  });
</script>

<section class="px-4 py-4">
  <h3 class="text-xs uppercase tracking-wider text-muted-foreground mb-2.5">
    Local time
  </h3>

  <div class="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-3xl font-semibold leading-none tabular-nums tracking-tight">
          {localTime}
        </p>
        <p class="text-sm text-muted-foreground mt-1.5 truncate">
          {localDateLabel}
        </p>
      </div>
      <div
        class={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          isDaytime
            ? 'bg-amber-400/15 text-amber-400'
            : 'bg-slate-500/15 text-slate-400',
        )}
        aria-hidden="true"
      >
        {#if isDaytime}
          <Sun size={20} />
        {:else}
          <Moon size={20} />
        {/if}
      </div>
    </div>

    <div
      class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
    >
      <span class="truncate">
        <span class="text-foreground font-medium">{tzCityLabel}</span>
        <span class="text-muted-foreground/80"> · {offsetLabel}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>{deltaLabel}</span>
    </div>
  </div>
</section>
