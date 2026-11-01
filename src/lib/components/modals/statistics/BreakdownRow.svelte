<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    share = 0,
    value,
    onclick,
    expanded,
    children,
  }: {
    /** The bar's length, from 0 to 1. */
    share?: number;
    value: number | string;
    onclick?: () => void;
    expanded?: boolean;
    children: Snippet;
  } = $props();
</script>

<button
  type="button"
  class="relative flex h-7 w-full items-center justify-between gap-2.5 rounded px-2 text-left text-[13px] outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
  aria-expanded={expanded}
  {onclick}
>
  {#if share > 0}
    <span
      class="absolute inset-y-0 left-0 rounded bg-primary/13 dark:bg-primary/25"
      style:width="{Math.max(share * 100, 2)}%"
    ></span>
  {/if}
  <span class="relative flex min-w-0 items-center gap-2">
    {@render children()}
  </span>
  <span class="relative shrink-0 font-medium tabular-nums">{value}</span>
</button>
