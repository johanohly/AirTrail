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
  import { formatTime, getPreferences } from '$lib/utils/preferences';

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

  const inlineLabel = $derived.by(() => {
    if (!date) return '';
    if (variant === 'time') return formatTime(date, prefs, primaryTz);

    const dateLabel = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      timeZone: primaryTz,
    }).format(date);
    if (variant === 'date') return dateLabel;

    return `${dateLabel}, ${formatTime(date, prefs, primaryTz)}`;
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
