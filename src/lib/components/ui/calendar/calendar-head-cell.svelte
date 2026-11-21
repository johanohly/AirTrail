<script lang="ts">
  import { Calendar as CalendarPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.HeadCellProps = $props();
</script>

<CalendarPrimitive.HeadCell
  bind:ref
  class={cn(
    'text-muted-foreground w-8 rounded-md text-[0.8rem] font-normal',
    className,
  )}
  {...restProps}
/>
