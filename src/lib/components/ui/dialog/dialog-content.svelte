<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import X from 'lucide-svelte/icons/x';
  import * as Dialog from './index.js';
  import { cn, flyAndScale } from '$lib/utils';

  let { classes = 'max-w-lg' } = $props();
</script>

<!--

This was originally modified to try animate the size change of the dialog content div when changing for example the settings page inside of it.
I never got it animating.

-->

<Dialog.Portal>
  <Dialog.Overlay />
  <DialogPrimitive.Content asChild let:builder>
    <div
      transition:flyAndScale={{ duration: 200 }}
      use:builder.action
      {...builder}
      class={cn(
        'bg-background fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg sm:rounded-lg md:w-full',
        classes,
      )}
    >
      <slot />
      <DialogPrimitive.Close
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-5 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
      >
        <X class="h-5 w-4" />
        <span class="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  </DialogPrimitive.Content>
</Dialog.Portal>
