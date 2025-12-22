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
      'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 sm:rounded-lg p-6 shadow-lg duration-200',
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
    {#if closeButton}
      <DialogPrimitive.Close
        class="absolute right-4 top-4 text-muted-foreground hover:bg-hover rounded-full p-2 transition-all duration-75 focus:outline-hidden"
      >
        <X size="20" />
        <span class="sr-only">Close</span>
      </DialogPrimitive.Close>
    {/if}
  </DialogPrimitive.Content>
</Dialog.Portal>
