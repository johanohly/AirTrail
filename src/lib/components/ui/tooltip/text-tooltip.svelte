<script lang="ts">
  import type { Snippet } from 'svelte';

  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Tooltip as TooltipPrimitive } from '$lib/primitives';

  let {
    content,
    children,
    rootProps,
    contentProps,
  }: {
    content: string;
    children: Snippet;
    rootProps?: TooltipPrimitive.RootProps;
    contentProps?: TooltipPrimitive.ContentProps;
  } = $props();
</script>

<Tooltip.Root disableHoverableContent {...rootProps}>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div {...props} class="inline-flex">
        {@render children()}
      </div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content {...contentProps}>
      {content}
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
