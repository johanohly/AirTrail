<script lang="ts">
  import type { Snippet } from 'svelte';

  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Drawer from '$lib/components/ui/drawer/index.js';
  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    open = $bindable(),
    class: className,
    dialogOnly = false,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeButton = true,
    children,
  }: {
    open: boolean;
    class?: string;
    dialogOnly?: boolean;
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
    closeButton?: boolean;
    children: Snippet;
  } = $props();
  const useDialog = isMediumScreen;
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open>
    <Dialog.Content
      class={cn('max-w-lg max-h-full overflow-y-auto', className)}
      {closeButton}
      preventScroll={false}
      escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
      interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
    >
      {@render children?.()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open>
    <Drawer.Content>
      <div class="mx-4 mb-4 overflow-y-auto">
        {@render children()}
      </div>
    </Drawer.Content>
  </Drawer.Root>
{/if}
