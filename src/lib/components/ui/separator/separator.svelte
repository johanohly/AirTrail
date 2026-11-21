<script lang="ts">
  import { Separator as SeparatorPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    orientation = 'horizontal',
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
  bind:ref
  class={cn(
    'bg-border shrink-0',
    orientation === 'horizontal' ? 'h-px w-full' : 'min-h-full w-px',
    className,
  )}
  {orientation}
  {...restProps}
/>
