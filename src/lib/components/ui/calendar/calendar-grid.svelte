<script lang="ts">
  import { Calendar as CalendarPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.GridProps = $props();
</script>

<CalendarPrimitive.Grid
  bind:ref
  class={cn('w-full border-collapse space-y-1', className)}
  {...restProps}
/>
