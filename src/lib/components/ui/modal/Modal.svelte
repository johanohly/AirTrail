<script lang="ts">
  import { isMediumScreen } from "$lib/utils/size";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Drawer from "$lib/components/ui/drawer/index.js";

  let { open = $bindable(), classes = "max-w-lg", dialogOnly = false } = $props();
  const useDialog = isMediumScreen;
</script>

{#if $useDialog || dialogOnly}
  <Dialog.Root bind:open preventScroll={false}>
    <Dialog.Content {classes}>
      <slot />
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open>
    <Drawer.Content>
      <div class="mx-4 mb-4">
        <slot />
      </div>
    </Drawer.Content>
  </Drawer.Root>
{/if}
