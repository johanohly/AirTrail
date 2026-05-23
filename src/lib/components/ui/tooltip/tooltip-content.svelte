<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    style,
    ...restProps
  }: TooltipPrimitive.ContentProps = $props();

  const modalCtx = getModalContext();
  const mergedStyle = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    const zStyle = modalZ !== undefined ? `z-index: ${modalZ + 5};` : '';
    return [zStyle, style].filter(Boolean).join(' ') || undefined;
  });
</script>

<TooltipPrimitive.Content
  bind:ref
  {sideOffset}
  class={cn(
    'bg-popover text-popover-foreground z-50 overflow-hidden rounded-md border px-3 py-1.5 text-sm shadow-md',
    className,
  )}
  style={mergedStyle}
  {...restProps}
/>
