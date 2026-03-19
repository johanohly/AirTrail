<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  type TransitionConfig = {
    type?: 'spring' | 'tween' | 'keyframes' | 'inertia';
    duration?: number;
    bounce?: number;
    [key: string]: unknown;
  };

  let {
    width = false,
    height = false,
    transition,
    class: className,
    children,
    ...restProps
  }: {
    width?: boolean;
    height?: boolean;
    transition?: TransitionConfig;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const defaultTransition = { type: 'spring' as const, duration: 0.3 };

  let containerRef = $state<HTMLDivElement | null>(null);
  let measuredWidth = $state<number | undefined>(undefined);
  let measuredHeight = $state<number | undefined>(undefined);
  let hasMeasured = $state(false);

  const isFirstMeasurement = $derived(
    (width ? measuredWidth != null : true) &&
      (height ? measuredHeight != null : true) &&
      !hasMeasured,
  );

  function getEffectiveTransition() {
    return (
      transition ?? (isFirstMeasurement ? { duration: 0 } : defaultTransition)
    );
  }

  function getAnimateTarget() {
    return {
      width: width
        ? measuredWidth == null
          ? 'auto'
          : `${measuredWidth}px`
        : 'auto',
      height: height
        ? measuredHeight == null
          ? 'auto'
          : `${measuredHeight}px`
        : 'auto',
    };
  }

  const transitionStyle = $derived.by(() => {
    const resolvedTransition = getEffectiveTransition();
    const duration =
      typeof resolvedTransition.duration === 'number'
        ? resolvedTransition.duration
        : defaultTransition.duration;

    const properties = [width && 'width', height && 'height']
      .filter(Boolean)
      .join(', ');

    return [
      `width: ${getAnimateTarget().width};`,
      `height: ${getAnimateTarget().height};`,
      properties ? `transition-property: ${properties};` : '',
      `transition-duration: ${isFirstMeasurement ? 0 : duration}s;`,
      'transition-timing-function: cubic-bezier(0.2, 0, 0, 1);',
      properties ? 'will-change: width, height;' : '',
    ].join(' ');
  });

  $effect(() => {
    if (!containerRef || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;

      measuredWidth = entry.contentRect.width;
      measuredHeight = entry.contentRect.height;
      hasMeasured = true;
    });

    observer.observe(containerRef);

    return () => {
      observer.disconnect();
    };
  });
</script>

<div
  class={cn('overflow-hidden', className)}
  style={transitionStyle}
  {...restProps}
>
  <div bind:this={containerRef} class={cn(height && 'h-max', width && 'w-max')}>
    {@render children?.()}
  </div>
</div>
