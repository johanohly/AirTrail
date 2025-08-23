<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLInputAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

  type Props = WithElementRef<HTMLInputAttributes>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    ...restProps
  }: Props = $props();
</script>

<input
  bind:this={ref}
  data-slot="input"
  class={cn(
    'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    className,
  )}
  bind:value
  {...restProps}
/>
