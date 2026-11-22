<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  let { onclick, children }: { onclick: () => void; children: Snippet } =
    $props();
</script>

<button
  type="button"
  class="mt-1 flex items-center gap-0.5 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
  {onclick}
>
  {@render children()}
  <ChevronRight size={13} />
</button>
