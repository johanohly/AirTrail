<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    href,
    title,
    children,
  }: { href: string; title: string | undefined; children: Snippet } = $props();

  let prNum = $derived(href.match(/pull\/(\d+)/)?.[1]);
</script>

<a target="_blank" {href} {title}>
  {#if prNum}
    #{prNum}
  {:else}
    {@render children()}
  {/if}
</a>
