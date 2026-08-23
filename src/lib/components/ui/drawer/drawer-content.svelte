<script lang="ts">
  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import DrawerOverlay from './drawer-overlay.svelte';
  import { getDrawerState } from './drawer.svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    style,
    noPadding = false,
    raw = false,
    onOverlayClick,
    overlayClass,
    overlayStyle,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
    noPadding?: boolean;
    raw?: boolean;
    onOverlayClick?: (event: MouseEvent) => void;
    overlayClass?: string;
    overlayStyle?: string;
    children?: Snippet;
  } = $props();

  const state = getDrawerState();

  $effect(() => {
    state.drawerNode = ref instanceof HTMLElement ? ref : null;
    return () => {
      state.drawerNode = null;
    };
  });

  const modal = $derived(state.opts.modal());
</script>

<DialogPrimitive.Portal>
  {#if modal}
    <DrawerOverlay
      class={overlayClass}
      style={overlayStyle}
      onclick={onOverlayClick}
    />
  {/if}
  <DialogPrimitive.Content
    bind:ref
    data-drawer=""
    data-dragging={state.isDraggingVisual ? '' : undefined}
    class={cn(
      raw
        ? 'z-50 fixed bottom-0 left-0 right-0 flex flex-col'
        : 'z-50 fixed bottom-0 left-0 right-0 flex flex-col bg-background rounded-t-[10px] border-t',
      className,
      'w-full max-w-none',
    )}
    style="{state.contentStyleVars}{style ?? ''}"
    preventScroll={modal}
    trapFocus={modal}
    onOpenAutoFocus={(e) => e.preventDefault()}
    onFocusOutside={(e) => {
      if (!modal) e.preventDefault();
    }}
    {...restProps}
    interactOutsideBehavior={modal
      ? (restProps.interactOutsideBehavior ?? 'close')
      : 'ignore'}
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
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
