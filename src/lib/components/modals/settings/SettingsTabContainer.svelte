<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<nav class="flex md:flex-col md:space-y-1">
  {@render children()}
</nav>
