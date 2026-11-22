<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';

  import { buttonVariants } from '$lib/components/ui/button';
  import { Calendar as CalendarPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronRight />
{/snippet}

<CalendarPrimitive.NextButton
  bind:ref
  class={cn(
    buttonVariants({ variant: 'outline' }),
    'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
    className,
  )}
  {...restProps}
  children={children || Fallback}
/>
