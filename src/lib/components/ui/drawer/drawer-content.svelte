<script lang="ts">
  import { Drawer as DrawerPrimitive } from 'vaul-svelte';

  import DrawerOverlay from './drawer-overlay.svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: DrawerPrimitive.ContentProps = $props();
</script>

<DrawerPrimitive.Portal>
  <DrawerOverlay />
  <DrawerPrimitive.Content
    bind:ref
    class={cn(
      'z-50 bg-background mt-24 fixed bottom-0 left-0 right-0 flex max-h-[90%] flex-col rounded-t-[10px] border',
      className,
    )}
    {...restProps}
  >
    <div class="flex flex-col overflow-y-auto rounded-t-[10px] p-4">
      <div
        class="bg-muted mx-auto mb-4 h-1.5 w-[100px] shrink-0 rounded-full"
      ></div>
      {@render children?.()}
    </div>
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>
