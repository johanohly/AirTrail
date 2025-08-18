<script lang="ts">
  import {
    Switch as SwitchPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    checked = $bindable(false),
    size = 'large',
    ...restProps
  }: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
    size?: 'small' | 'large';
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:ref
  bind:checked
  class={cn(
    'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'small' ? 'h-[16px] w-[28px]' : 'h-[24px] w-[44px]',
    className,
  )}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    class={cn(
      'bg-background pointer-events-none block size-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
      size === 'small'
        ? 'h-3 w-3 data-[state=checked]:translate-x-3'
        : 'h-5 w-5 data-[state=checked]:translate-x-5',
    )}
  />
</SwitchPrimitive.Root>
