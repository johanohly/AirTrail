<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
  {@render children()}
</nav>
