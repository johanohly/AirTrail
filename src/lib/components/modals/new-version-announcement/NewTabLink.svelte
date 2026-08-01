<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    href,
    title,
    children,
  }: {
    href?: string;
    title?: string;
    children?: Snippet;
  } = $props();

  let prNum = $derived(href?.match(/pull\/(\d+)/)?.[1]);
</script>

<a target="_blank" rel="noopener noreferrer" {href} {title}>
  {#if prNum}
    #{prNum}
  {:else}
    {@render children?.()}
  {/if}
</a>
