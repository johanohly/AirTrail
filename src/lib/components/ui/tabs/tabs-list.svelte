<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List
  bind:ref
  data-slot="tabs-list"
  class={cn(
    'bg-muted dark:bg-muted/50 text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
    className,
  )}
  {...restProps}
/>
