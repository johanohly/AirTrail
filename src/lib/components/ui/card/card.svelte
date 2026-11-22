<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  import type { WithElementRef } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    level = '1',
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    level?: '1' | '2';
  } = $props();

  const rounded = $derived(level === '1' ? 'rounded-xl' : 'rounded-md');
  const darkBg = $derived(level === '1' ? 'dark:bg-dark-1' : 'dark:bg-dark-2');
</script>

<div
  bind:this={ref}
  class={cn(
    `bg-card ${darkBg} text-card-foreground ${rounded} border shadow-xs`,
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
