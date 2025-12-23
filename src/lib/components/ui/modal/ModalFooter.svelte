<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div
  class="flex items-center justify-end gap-2 border-t bg-neutral-50 dark:bg-input/30 p-4"
>
  {@render children()}
</div>
