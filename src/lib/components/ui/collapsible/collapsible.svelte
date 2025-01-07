<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';
  import { Collapsible, type WithoutChild } from 'bits-ui';
  import type { ClassValue } from 'clsx';
  import { slide } from 'svelte/transition';

  import { cn } from '$lib/utils';

  type Props = WithoutChild<Collapsible.RootProps> & {
    title: string;
    subtitle?: string;
    disabled?: boolean;
    className?: ClassValue[];
  };

  let {
    open = $bindable(false),
    disabled = false,
    title,
    subtitle,
    class: className,
    children,
    ...restProps
  }: Props = $props();
</script>

<Collapsible.Root
  bind:open
  {disabled}
  class={cn('w-full flex flex-col p-4 rounded-lg border', className)}
  {...restProps}
>
  <Collapsible.Trigger class="flex justify-between text-left">
    <div class="space-y-0.5">
      <h4 class={cn('font-medium', { 'leading-4': subtitle })}>{title}</h4>
      {#if subtitle}
        <p class="text-sm text-muted-foreground">{subtitle}</p>
      {/if}
    </div>
    <div class="flex items-center justify-center">
      <ChevronRight class={cn('transition-transform', { 'rotate-90': open })} />
    </div>
  </Collapsible.Trigger>
  <Collapsible.Content forceMount>
    {#snippet child({ props, open })}
      {#if open}
        <div {...props} transition:slide class="mt-4 flex flex-col space-y-2">
          {@render children?.()}
        </div>
      {/if}
    {/snippet}
  </Collapsible.Content>
</Collapsible.Root>
