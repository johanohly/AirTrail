<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import {
    timeDisplayTether,
    type TimeDisplayMode,
    type TimeDisplaySide,
  } from './time-display-tether.svelte';

  import { page } from '$app/state';
  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import { cn } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

  type Variant = 'time' | 'date' | 'datetime';

  let {
    date,
    airportTz = null,
    airportLabel = null,
    mode = 'flight',
    variant = 'datetime',
    side = 'top',
    class: className,
    children,
  }: {
    date: Date | null | undefined;
    airportTz?: string | null;
    airportLabel?: string | null;
    mode?: TimeDisplayMode;
    variant?: Variant;
    side?: TimeDisplaySide;
    class?: string;
    children?: Snippet;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));

  const systemTz = $derived(
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC',
  );

  const primaryTz = $derived.by(() => {
    if (mode === 'plain') return systemTz;
    if (prefs.flightTimeDisplay === 'utc') return 'UTC';
    if (prefs.flightTimeDisplay === 'system') return systemTz;
    return airportTz ?? 'UTC';
  });

  const hour12 = $derived.by(() => {
    if (prefs.timeFormat === '12h') return true;
    if (prefs.timeFormat === '24h') return false;
    return undefined;
  });

  const inlineLabel = $derived.by(() => {
    if (!date) return '';
    const opts: Intl.DateTimeFormatOptions = { timeZone: primaryTz };
    if (variant !== 'time') {
      opts.day = 'numeric';
      opts.month = 'short';
    }
    if (variant !== 'date') {
      opts.hour = 'numeric';
      opts.minute = 'numeric';
      if (hour12 === true) opts.hour12 = true;
      else if (hour12 === false) opts.hourCycle = 'h23';
    }
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  });

  const modalCtx = getModalContext();
  const payload = $derived.by(() => {
    if (!date) return undefined;
    const modalZ = modalCtx?.getContentZIndex();
    return {
      date,
      airportTz,
      airportLabel,
      mode,
      side,
      zIndex: modalZ !== undefined ? modalZ + 5 : undefined,
    };
  });
</script>

{#if date}
  <TooltipPrimitive.Trigger tether={timeDisplayTether} {payload}>
    {#snippet child({ props })}
      <span
        {...props}
        class={cn(
          'cursor-default underline decoration-dotted decoration-transparent underline-offset-2 transition-colors hover:decoration-muted-foreground/50',
          className,
        )}
      >
        {#if children}{@render children()}{:else}{inlineLabel}{/if}
      </span>
    {/snippet}
  </TooltipPrimitive.Trigger>
{/if}
