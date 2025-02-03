<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props();
</script>

<tfoot
  bind:this={ref}
  class={cn('bg-muted/50 font-medium', className)}
  {...restProps}
>
  {@render children?.()}
</tfoot>
