<script lang="ts">
  import type { Snippet } from 'svelte';

  import { getModalContext } from './Modal.svelte';
  import { cn } from '$lib/utils';

  let {
    children,
    class: className,
  }: {
    children: Snippet;
    class?: string;
  } = $props();

  const ctx = getModalContext();
  ctx.registerFooter();
</script>

<div
  class={cn(
    'flex items-center justify-end gap-2 border-t bg-neutral-50 dark:bg-input/30 p-4',
    className,
  )}
>
  {@render children()}
</div>
