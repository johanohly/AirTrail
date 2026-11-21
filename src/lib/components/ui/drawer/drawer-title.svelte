<script lang="ts">
  import type { Snippet } from 'svelte';

  import {
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from '$lib/primitives';
  import { cn } from '$lib/utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.TitleProps> & {
    children?: Snippet;
  } = $props();
</script>

<DialogPrimitive.Title
  bind:ref
  class={cn('text-lg font-semibold leading-none tracking-tight', className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Title>
