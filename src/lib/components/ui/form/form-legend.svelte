<script lang="ts">
  import type { WithoutChild } from 'bits-ui';
  import * as FormPrimitive from 'formsnap';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChild<FormPrimitive.LegendProps> = $props();
</script>

<FormPrimitive.Legend
  bind:ref
  class={cn(
    'data-[fs-error]:text-destructive text-sm font-medium leading-none',
    className,
  )}
  {...restProps}
/>
