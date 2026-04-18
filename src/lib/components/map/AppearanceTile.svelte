<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  let {
    label,
    selected,
    onclick,
    illustration,
    compact = false,
  }: {
    label: string;
    selected: boolean;
    onclick: () => void;
    illustration: Snippet;
    compact?: boolean;
  } = $props();
</script>

<button
  type="button"
  aria-pressed={selected}
  {onclick}
  class={cn(
    'group flex flex-col items-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    selected
      ? 'border-primary bg-primary/5'
      : 'border-muted hover:border-accent hover:bg-accent/40',
    compact ? 'p-1.5' : 'p-2',
  )}
>
  <div
    class={cn(
      'flex w-full items-center justify-center overflow-hidden rounded-sm bg-muted dark:bg-muted/50',
      compact ? 'h-7' : 'h-10',
    )}
  >
    {@render illustration()}
  </div>
  <span
    class={cn(
      'mt-1 w-full text-center leading-none',
      compact ? 'text-[10px]' : 'text-[11px]',
      selected ? 'text-foreground font-medium' : 'text-muted-foreground',
    )}
  >
    {label}
  </span>
</button>
