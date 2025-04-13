<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
  bind:ref
  class={cn(
    'animate-in fade-in fixed inset-0 z-50 bg-neutral-100/50 backdrop-blur-md dark:bg-neutral-900/40',
    className,
  )}
  {...restProps}
/>
