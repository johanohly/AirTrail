<script lang="ts">
  import { Lock } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';

  let {
    locked,
    tooltip,
    class: className,
    children,
  }: {
    locked: boolean;
    tooltip: Snippet;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<Tooltip.Root delayDuration={0} disabled={!locked}>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div class={cn('relative', { 'cursor-pointer': locked })} {...props}>
        <div
          class={cn(
            { 'opacity-80 blur-[1px] select-none pointer-events-none': locked },
            className,
          )}
        >
          {@render children()}
        </div>
        {#if locked}
          <div class="absolute top-1 right-1">
            <Lock />
          </div>
        {/if}
      </div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content sideOffset={20}>
      {@render tooltip()}
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
