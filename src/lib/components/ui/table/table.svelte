<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLTableAttributes } from 'svelte/elements';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div class="relative w-full overflow-auto">
  <table
    bind:this={ref}
    class={cn('w-full caption-bottom text-sm', className)}
    {...restProps}
  >
    {@render children?.()}
  </table>
</div>
