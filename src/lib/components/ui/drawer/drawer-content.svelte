<script lang="ts">
  import { Drawer as DrawerPrimitive } from '@johly/vaul-svelte';

  import DrawerOverlay from './drawer-overlay.svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    noPadding = false,
    children,
    ...restProps
  }: DrawerPrimitive.ContentProps & { noPadding?: boolean } = $props();
</script>

<DrawerPrimitive.Portal>
  <DrawerOverlay />
  <DrawerPrimitive.Content
    bind:ref
    class={cn(
      'z-50 fixed bottom-0 left-0 right-0 flex flex-col bg-background rounded-t-[10px] border-t',
      className,
    )}
    {...restProps}
  >
    <div
      class="scrollbar-hide flex-1 overflow-y-auto rounded-t-[10px] bg-inherit"
    >
      <div
        class="sticky top-0 z-20 flex items-center justify-center rounded-t-[10px] bg-inherit"
      >
        <div class="my-3 bg-muted h-1.5 w-12 shrink-0 rounded-full"></div>
      </div>
      <div class:p-3={!noPadding}>
        {@render children?.()}
      </div>
    </div>
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>
