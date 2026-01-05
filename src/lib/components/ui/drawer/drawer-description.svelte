<script lang="ts">
  import { Drawer as DrawerPrimitive } from '@johly/vaul-svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DrawerPrimitive.DescriptionProps = $props();
</script>

<DrawerPrimitive.Description
  bind:ref
  class={cn('text-muted-foreground text-sm', className)}
  {...restProps}
/>
