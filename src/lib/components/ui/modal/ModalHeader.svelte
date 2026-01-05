<script lang="ts">
  import { X } from '@o7/icon';
  import { type Snippet } from 'svelte';

  import { getModalContext } from './Modal.svelte';

  let { children }: { children: Snippet } = $props();

  const ctx = getModalContext();
  ctx.registerHeader();
</script>

<div
  class="flex items-start gap-2 px-6 py-3 md:items-center md:justify-between"
>
  {@render children()}
  <button
    onclick={ctx.closeModal}
    class="hidden md:block text-muted-foreground hover:bg-hover rounded-full p-2 transition-all duration-75 focus:outline-hidden"
  >
    <X size={20} />
    <span class="sr-only">Close</span>
  </button>
</div>
