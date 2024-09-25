<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<nav class="flex lg:flex-col lg:space-y-1">
  {@render children()}
</nav>
