<script lang="ts">
  import { Drawer as DrawerPrimitive } from '@johly/vaul-svelte';

  import DrawerOverlay from './drawer-overlay.svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    noPadding = false,
    raw = false,
    overlayClass,
    overlayStyle,
    children,
    ...restProps
  }: DrawerPrimitive.ContentProps & {
    noPadding?: boolean;
    raw?: boolean;
    overlayClass?: string;
    overlayStyle?: string;
  } = $props();
</script>

<DrawerPrimitive.Portal>
  <DrawerOverlay class={overlayClass} style={overlayStyle} />
  <DrawerPrimitive.Content
    bind:ref
    class={cn(
      raw
        ? 'z-50 fixed bottom-0 left-0 right-0 flex flex-col'
        : 'z-50 fixed bottom-0 left-0 right-0 flex flex-col bg-background rounded-t-[10px] border-t',
      className,
    )}
    {...restProps}
  >
    {#if raw}
      {@render children?.()}
    {:else}
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
    {/if}
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>
