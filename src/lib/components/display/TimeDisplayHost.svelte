<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';
  import { Settings2 } from '@o7/icon/lucide';
  import { setContext } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { timeDisplayTether } from './time-display-tether.svelte';

  import { page } from '$app/state';
  import { PreferenceField } from '$lib/components/preferences';
  import {
    ModalContextKey,
    type ModalContext,
  } from '$lib/components/ui/modal/Modal.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import { formatTime, getPreferences } from '$lib/utils/preferences';

  const prefs = $derived(getPreferences(page.data.user));

  const systemTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const offsetLabel = (tz: string, at: Date): string => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(at);
      const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
      if (raw === 'UTC' || raw === 'GMT' || raw.startsWith('GMT')) return raw;
      if (/^[+-]\d/.test(raw)) return `GMT${raw}`;
      return raw;
    } catch {
      return tz;
    }
  };

  type Row = {
    badge: string;
    dateLabel: string;
    timeLabel: string;
  };

  const buildRow = (tz: string, badge: string, date: Date): Row => {
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    const timeLabel = formatTime(date, prefs, tz);
    return { badge, dateLabel, timeLabel };
  };

  let now = $state(Date.now());
  let transitionEnabled = $state(false);

  // Tooltip is hover-driven via the tether; we hold it open while the prefs
  // popover is open so the Select dropdowns (which portal outside the tooltip
  // body) don't break the hover chain.
  let tooltipOpen = $state(false);
  let prefsOpen = $state(false);

  $effect(() => {
    // Re-assert whenever the popover is open. bits-ui's hover-close path
    // writes `false` back through the bind; this effect immediately reverses
    // that while the popover is active.
    if (prefsOpen && !tooltipOpen) tooltipOpen = true;
  });

  // Mirror the active payload's z-index into a modal context. popover-content
  // and select-content both read getContentZIndex() at mount time to stack
  // themselves above the tooltip; without this they'd fall back to the
  // default `z-50` class and disappear behind the tooltip when it's rendered
  // inside a modal.
  //
  // Deliberately a plain `let` (not `$state`) — Svelte 5 forbids state writes
  // from template expressions, and we don't need reactivity here because the
  // popover/select mount inside the snippet body and capture the current
  // value on each fresh open.
  let activeZIndex: number | undefined = undefined;
  const hostModalContext: ModalContext = {
    closeModal: () => {},
    registerHeader: () => {},
    registerFooter: () => {},
    getState: () => ({ hasHeader: false, hasFooter: false }),
    getContentZIndex: () => activeZIndex,
  };
  setContext(ModalContextKey, hostModalContext);

  const trackPayloadZIndex = (z: number | undefined) => {
    activeZIndex = z;
    return null;
  };

  $effect(() => {
    if (!timeDisplayTether.isOpen) {
      transitionEnabled = false;
      return;
    }
    now = Date.now();
    const tickId = setInterval(() => {
      now = Date.now();
    }, 1000);
    const enableId = setTimeout(() => {
      transitionEnabled = true;
    }, 220);
    return () => {
      clearInterval(tickId);
      clearTimeout(enableId);
    };
  });

  const copyRow = async (
    badge: string,
    dateLabel: string,
    timeLabel: string,
  ) => {
    const text = `${dateLabel}, ${timeLabel} ${badge}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${badge} time`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const formatRelative = (target: number, current: number): string => {
    const diffMs = current - target;
    const past = diffMs >= 0;
    const suffix = past ? 'ago' : 'from now';
    const abs = Math.round(Math.abs(diffMs) / 1000);
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

    if (abs < 60) return `${plural(abs, 'second')} ${suffix}`;
    if (abs < 3600) {
      const m = Math.floor(abs / 60);
      const s = abs % 60;
      return s > 0
        ? `${plural(m, 'minute')}, ${plural(s, 'second')} ${suffix}`
        : `${plural(m, 'minute')} ${suffix}`;
    }
    if (abs < 86400) {
      const h = Math.floor(abs / 3600);
      const m = Math.floor((abs % 3600) / 60);
      return m > 0
        ? `${plural(h, 'hour')}, ${plural(m, 'minute')} ${suffix}`
        : `${plural(h, 'hour')} ${suffix}`;
    }
    if (abs < 86400 * 30) {
      const d = Math.floor(abs / 86400);
      const h = Math.floor((abs % 86400) / 3600);
      return h > 0
        ? `${plural(d, 'day')}, ${plural(h, 'hour')} ${suffix}`
        : `${plural(d, 'day')} ${suffix}`;
    }
    if (abs < 86400 * 365) {
      const months = Math.floor(abs / (86400 * 30));
      const days = Math.floor((abs % (86400 * 30)) / 86400);
      return days > 0
        ? `${plural(months, 'month')}, ${plural(days, 'day')} ${suffix}`
        : `${plural(months, 'month')} ${suffix}`;
    }
    const years = Math.floor(abs / (86400 * 365));
    const months = Math.min(
      11,
      Math.floor((abs % (86400 * 365)) / (86400 * 30)),
    );
    return months > 0
      ? `${plural(years, 'year')}, ${plural(months, 'month')} ${suffix}`
      : `${plural(years, 'year')} ${suffix}`;
  };
</script>

<TooltipPrimitive.Root
  tether={timeDisplayTether}
  delayDuration={250}
  bind:open={tooltipOpen}
>
  {#snippet children({ payload })}
    {#if payload}
      {@const date = payload.date}
      {@const _zSync = trackPayloadZIndex(payload.zIndex)}
      {@const rows = [
        ...(payload.mode === 'flight' && payload.airportTz
          ? [
              buildRow(
                payload.airportTz,
                payload.airportLabel ?? offsetLabel(payload.airportTz, date),
                date,
              ),
            ]
          : []),
        buildRow('UTC', 'UTC', date),
        buildRow(systemTz, offsetLabel(systemTz, date), date),
      ]}
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={8} side={payload.side ?? 'top'}>
          {#snippet child({ props, wrapperProps })}
            <div
              {...wrapperProps}
              style:transition={transitionEnabled
                ? 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
                : 'none'}
            >
              <div
                {...props}
                style:z-index={payload.zIndex}
                class="bg-popover text-popover-foreground rounded-md border shadow-md p-3 min-w-[260px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              >
                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      class="tabular-nums text-xs font-medium text-muted-foreground leading-none"
                    >
                      {formatRelative(date.getTime(), now)}
                    </span>
                    <Popover.Root bind:open={prefsOpen}>
                      <Popover.Trigger>
                        {#snippet child({ props })}
                          <button
                            {...props}
                            type="button"
                            aria-label="Time display preferences"
                            class="-m-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground"
                          >
                            <Settings2 size={12} />
                          </button>
                        {/snippet}
                      </Popover.Trigger>
                      <Popover.Content
                        align="end"
                        sideOffset={10}
                        class="w-64 p-3"
                      >
                        <div class="flex flex-col gap-3">
                          {#if payload.mode === 'flight'}
                            <PreferenceField field="flightTimeDisplay" />
                          {/if}
                          <PreferenceField field="timeFormat" />
                          <PreferenceField field="dateFormat" />
                        </div>
                      </Popover.Content>
                    </Popover.Root>
                  </div>
                  <div class="flex flex-col -mx-1.5">
                    {#each rows as row, i (i)}
                      <button
                        type="button"
                        onclick={(e) => {
                          copyRow(row.badge, row.dateLabel, row.timeLabel);
                          (e.currentTarget as HTMLButtonElement).blur();
                        }}
                        class="flex items-center justify-between gap-3 px-1.5 py-1 rounded-sm cursor-copy text-left transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 active:bg-foreground/10 focus:outline-none"
                      >
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span
                            class="inline-flex items-center justify-center h-4 px-1.5 bg-foreground/10 text-foreground/75 rounded-xs text-[10px] font-mono font-semibold leading-none tabular-nums"
                          >
                            {row.badge}
                          </span>
                          <span class="text-xs text-foreground/90 truncate">
                            {row.dateLabel}
                          </span>
                        </div>
                        <span
                          class="tabular-nums text-[11px] font-mono text-foreground/90 leading-none"
                        >
                          {row.timeLabel}
                        </span>
                      </button>
                    {/each}
                  </div>
                </div>
                <TooltipPrimitive.Arrow width={12} height={6}>
                  <svg
                    width="12"
                    height="6"
                    viewBox="0 0 12 6"
                    preserveAspectRatio="none"
                    data-arrow=""
                    style="display: block; overflow: visible;"
                  >
                    <polygon
                      points="-1,-1 13,-1 6,6"
                      fill="var(--color-popover)"
                    />
                    <polyline
                      points="0,0 6,6 12,0"
                      fill="none"
                      stroke="var(--color-border)"
                      stroke-width="1"
                      stroke-linejoin="round"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                </TooltipPrimitive.Arrow>
              </div>
            </div>
          {/snippet}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    {/if}
  {/snippet}
</TooltipPrimitive.Root>
