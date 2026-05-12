<script lang="ts">
  import type { Locate } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    label,
    icon: Icon,
    onclick,
    pressed = false,
  }: {
    label: string;
    icon: typeof Locate;
    onclick: () => void;
    pressed?: boolean;
  } = $props();
</script>

<Tooltip.Root delayDuration={0} disableHoverableContent>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant={pressed ? 'secondary' : 'ghost'}
        size="sm"
        class="h-9 flex-1 px-2 md:size-8 md:flex-none md:px-0"
        {onclick}
        aria-label={label}
        aria-pressed={pressed || undefined}
      >
        <Icon size={16} />
        <span class="text-xs md:sr-only">{label}</span>
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content side="right" sideOffset={8} class="hidden md:block">
      {label}
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
