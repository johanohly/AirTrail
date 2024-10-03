<script lang="ts">
  import { isMediumScreen } from '$lib/utils/size';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Drawer from '$lib/components/ui/drawer/index.js';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(),
    classes = 'max-w-lg',
    dialogOnly = false,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeButton = true,
    children,
  }: {
    open: boolean;
    classes?: string;
    dialogOnly?: boolean;
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
    closeButton?: boolean;
    children: Snippet;
  } = $props();
  const useDialog = isMediumScreen;
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root
    bind:open
    preventScroll={false}
    {closeOnOutsideClick}
    {closeOnEscape}
  >
    <Dialog.Content {classes} {closeButton}>
      {@render children()}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open>
    <Drawer.Content>
      <div class="mx-4 mb-4">
        {@render children()}
      </div>
    </Drawer.Content>
  </Drawer.Root>
{/if}
