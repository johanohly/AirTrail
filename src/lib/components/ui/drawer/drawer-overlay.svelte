<script lang="ts">
  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';

  import { getDrawerState } from './drawer.svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    style,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.OverlayProps> = $props();

  const state = getDrawerState();

  $effect(() => {
    state.overlayNode = ref instanceof HTMLElement ? ref : null;
    return () => {
      state.overlayNode = null;
    };
  });
</script>

<DialogPrimitive.Overlay
  bind:ref
  data-drawer-overlay=""
  data-dragging={state.isDraggingVisual ? '' : undefined}
  class={cn('fixed inset-0 z-50 bg-black/80', className)}
  style="{state.overlayStyleVars}{style ?? ''}"
  {...restProps}
/>
