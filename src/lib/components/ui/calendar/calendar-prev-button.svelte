<script lang="ts">
  import { ChevronLeft } from '@o7/icon/lucide';
  import { Calendar as CalendarPrimitive } from 'bits-ui';

  import { buttonVariants } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronLeft />
{/snippet}

<CalendarPrimitive.PrevButton
  bind:ref
  class={cn(
    buttonVariants({ variant: 'outline-solid' }),
    'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
    className,
  )}
  {...restProps}
  children={children || Fallback}
/>
