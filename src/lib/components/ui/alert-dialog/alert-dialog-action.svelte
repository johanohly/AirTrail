<script lang="ts">
  import { buttonVariants } from '$lib/components/ui/button';
  import { AlertDialog as AlertDialogPrimitive } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: AlertDialogPrimitive.ActionProps = $props();
</script>

<AlertDialogPrimitive.Action
  bind:ref
  class={cn(buttonVariants(), className)}
  {...restProps}
/>
