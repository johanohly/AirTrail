<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  type $$Props = SwitchPrimitive.Props & {
    size?: 'small' | 'large';
  };
  type $$Events = SwitchPrimitive.Events;

  let className: $$Props['class'] = undefined;
  export let checked: $$Props['checked'] = undefined;
  export let size: $$Props['size'] = 'large';
  export { className as class };
</script>

<SwitchPrimitive.Root
  bind:checked
  class={cn(
    'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'small' ? 'h-[16px] w-[28px]' : 'h-[24px] w-[44px]',
    className,
  )}
  {...$$restProps}
  on:click
  on:keydown
>
  <SwitchPrimitive.Thumb
    class={cn(
      'bg-background pointer-events-none block rounded-full shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0',
      size === 'small'
        ? 'h-3 w-3 data-[state=checked]:translate-x-3'
        : 'h-5 w-5 data-[state=checked]:translate-x-5',
    )}
  />
</SwitchPrimitive.Root>
