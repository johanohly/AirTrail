<script lang="ts">
  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.DescriptionProps> & {
    children?: Snippet;
  } = $props();
</script>

<DialogPrimitive.Description
  bind:ref
  class={cn('text-muted-foreground text-sm', className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Description>
