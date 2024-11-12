<script lang="ts">
  import { Check, Minus } from '@o7/icon/lucide';
  import {
    Checkbox as CheckboxPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
  bind:ref
  class={cn(
    'border-foreground ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-foreground data-[state=checked]:text-white data-[state=checked]:dark:text-black peer box-content size-4 shrink-0 rounded-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50',
    className,
  )}
  bind:checked
  {...restProps}
>
  {#snippet children({ checked })}
    <div class="flex size-4 items-center justify-center text-current">
      {#if checked === 'indeterminate'}
        <Minus class="size-3.5" />
      {:else}
        <Check class={cn('size-3.5', !checked && 'text-transparent')} />
      {/if}
    </div>
  {/snippet}
</CheckboxPrimitive.Root>
