<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  let {
    class: className = '',
    gradient = false,
    children,
  }: {
    class: string;
    gradient?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class={cn('flex items-center w-full', className)}>
  <div
    class={cn(
      'rounded-full w-full h-px',
      gradient
        ? 'bg-linear-to-r from-transparent dark:from-zinc-800 dark:to-zinc-400 to-zinc-500'
        : 'bg-zinc-300 dark:bg-zinc-800',
    )}
  ></div>
  <div class="text-gray-600 uppercase w-fit dark:text-gray-300 text-nowrap">
    {@render children()}
  </div>
  <div
    class={cn(
      'rounded-full w-full h-px',
      gradient
        ? 'bg-linear-to-r from-zinc-500 dark:from-zinc-200 to-transparent dark:to-zinc-700'
        : 'bg-zinc-300 dark:bg-zinc-800',
    )}
  ></div>
</div>
