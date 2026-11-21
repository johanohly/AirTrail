<script lang="ts">
  import { Label as LabelPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
  bind:ref
  class={cn(
    'text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className,
  )}
  {...restProps}
/>
