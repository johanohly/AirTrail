<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    variant = 'default',
    ...restProps
  }: DropdownMenuPrimitive.ItemProps & {
    variant?: 'default' | 'destructive';
  } = $props();
</script>

<DropdownMenuPrimitive.Item
  bind:ref
  class={cn(
    'cursor-default data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:shrink-0',
    variant === 'destructive' &&
      'text-destructive data-[highlighted]:text-destructive',
    className,
  )}
  {...restProps}
/>
