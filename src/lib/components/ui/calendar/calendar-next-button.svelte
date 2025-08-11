<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';
  import { Calendar as CalendarPrimitive } from 'bits-ui';

  import { buttonVariants } from '$lib/components/ui/button';
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
    buttonVariants({ variant: 'outline-solid' }),
    'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
    className,
  )}
  {...restProps}
  children={children || Fallback}
/>
