<script lang="ts">
  import { renderHashvatar, type HashvatarOptions } from 'hashvatar';
  import type { HTMLCanvasAttributes } from 'svelte/elements';

  import { page } from '$app/state';
  import { cn } from '$lib/utils';

  type UserAvatarProps = Omit<HTMLCanvasAttributes, 'height' | 'width'> & {
    username?: string | null;
    size?: number;
    mode?: HashvatarOptions['mode'];
    animated?: boolean;
    dotScale?: number;
    tones?: HashvatarOptions['tones'];
  };

  let {
    username,
    size = 32,
    mode = 'dither',
    animated = false,
    dotScale,
    tones,
    class: className,
    title,
    'aria-label': ariaLabel,
    ...restProps
  }: UserAvatarProps = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  const resolvedUsername = $derived(
    username ?? page.data.user?.username ?? 'anonymous',
  );
  const accessibleLabel = $derived(
    ariaLabel ?? title ?? `${resolvedUsername} avatar`,
  );

  $effect(() => {
    if (!canvas) return;

    return renderHashvatar(canvas, {
      hash: resolvedUsername,
      size,
      mode,
      animated,
      dotScale,
      tones,
    });
  });
</script>

<canvas
  bind:this={canvas}
  role="img"
  aria-label={accessibleLabel}
  {title}
  class={cn('block shrink-0 rounded-full bg-muted', className)}
  {...restProps}
></canvas>
