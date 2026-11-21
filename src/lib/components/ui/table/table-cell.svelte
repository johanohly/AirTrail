<script lang="ts">
  import type { HTMLTdAttributes } from 'svelte/elements';

  import type { WithElementRef } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td
  bind:this={ref}
  class={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
  {...restProps}
>
  {@render children?.()}
</td>
