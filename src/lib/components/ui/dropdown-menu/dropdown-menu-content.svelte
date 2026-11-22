<script lang="ts">
  // The filter menu's sheet styles every dropdown, so all menus look alike.
  import '$lib/components/flight-filters/filter.css';

  import { getModalContext } from '$lib/components/ui/modal/Modal.svelte';
  import { DropdownMenu as DropdownMenuPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    style,
    ...restProps
  }: DropdownMenuPrimitive.ContentProps = $props();

  const modalCtx = getModalContext();
  const mergedStyle = $derived.by(() => {
    const modalZ = modalCtx?.getContentZIndex();
    const zStyle = modalZ !== undefined ? `z-index: ${modalZ + 5};` : '';
    return [zStyle, style].filter(Boolean).join(' ') || undefined;
  });
</script>

<DropdownMenuPrimitive.Portal>
  <DropdownMenuPrimitive.Content
    bind:ref
    {sideOffset}
    class={cn('min-w-44 py-1', className)}
    style={mergedStyle}
    {...restProps}
  />
</DropdownMenuPrimitive.Portal>
