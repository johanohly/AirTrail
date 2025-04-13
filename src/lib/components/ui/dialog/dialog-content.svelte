<script lang="ts">
  import { X } from '@o7/icon/lucide';
  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import * as Dialog from './index.js';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    closeButton = true,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
    closeButton?: boolean;
    children: Snippet;
  } = $props();
</script>

<!--

This was originally modified to try animate the size change of the dialog content div when changing for example the settings page inside of it.
I never got it animating.

-->

<Dialog.Portal>
  <Dialog.Overlay />
  <DialogPrimitive.Content
    bind:ref
    class={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 sm:rounded-lg',
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
    {#if closeButton}
      <DialogPrimitive.Close
        class="absolute right-4 top-4 text-muted-foreground hover:bg-hover rounded-full p-2 transition-all duration-75 focus:outline-none"
      >
        <X size="20" />
        <span class="sr-only">Close</span>
      </DialogPrimitive.Close>
    {/if}
  </DialogPrimitive.Content>
</Dialog.Portal>
