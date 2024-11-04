<script lang="ts">
  import { cn } from '$lib/utils';
  import {
    Motion,
    useMotionValue,
    useSpring,
    useTransform,
  } from 'svelte-motion';
  import { dockContext } from './context.svelte';
  import type { Snippet } from 'svelte';

  let {
    class: className = undefined,
    children,
  }: { class?: string; children: Snippet } = $props();

  let mint = useMotionValue(dockContext.mouseX);
  $effect(() => mint.set(dockContext.mouseX));

  let iconElement: HTMLDivElement;

  let distanceCalc = useTransform(mint, (val: number) => {
    const bounds = iconElement?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  let widthSync = useTransform(
    distanceCalc,
    [-dockContext.distance, 0, dockContext.distance],
    [38, dockContext.magnification, 38],
  );

  let width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  let iconClass = cn(
    'flex aspect-square cursor-pointer items-center justify-center rounded-full',
    className,
  );
</script>

<Motion style={{ width: width }} let:motion>
  <div use:motion bind:this={iconElement} class={iconClass}>
    {@render children()}
  </div>
</Motion>
