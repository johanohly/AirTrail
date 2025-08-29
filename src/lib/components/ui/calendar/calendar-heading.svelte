<script lang="ts">
  import { type DateValue } from '@internationalized/date';
  import { Calendar as CalendarPrimitive } from 'bits-ui';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    placeholder = $bindable(),
    mode = $bindable(),
    ...restProps
  }: CalendarPrimitive.HeadingProps & {
    placeholder: DateValue | undefined;
    mode: 'normal' | 'year' | 'month';
  } = $props();

  let monthLabel = $derived(
    placeholder
      ? new Date(0, placeholder.month - 1).toLocaleString(navigator.language, {
          month: 'long',
        })
      : undefined,
  );
</script>

<CalendarPrimitive.Heading
  bind:ref
  class={cn('text-sm font-medium', className)}
  {...restProps}
>
  {#snippet child({ props })}
    <div {...props}>
      <button
        onclick={() => (mode = mode !== 'month' ? 'month' : 'normal')}
        class={cn('hover:underline', { underline: mode === 'month' })}
        >{monthLabel}</button
      >
      <button
        onclick={() => (mode = mode !== 'year' ? 'year' : 'normal')}
        class={cn('hover:underline', { underline: mode === 'year' })}
        >{placeholder?.year}</button
      >
    </div>
  {/snippet}
</CalendarPrimitive.Heading>
