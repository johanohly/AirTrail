<script lang="ts">
  import type { Locate } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    label,
    icon: Icon,
    onclick,
    pressed = false,
    shortLabel = label,
  }: {
    label: string;
    icon: typeof Locate;
    onclick: () => void;
    pressed?: boolean;
    shortLabel?: string;
  } = $props();
</script>

<Tooltip.Root delayDuration={0} disableHoverableContent>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant={pressed ? 'secondary' : 'ghost'}
        size="sm"
        class="h-9 min-w-0 flex-1 gap-1.5 px-1.5 sm:px-2 md:size-8 md:flex-none md:px-0"
        {onclick}
        aria-label={label}
        aria-pressed={pressed || undefined}
      >
        <Icon size={16} />
        <span class="min-w-0 truncate text-[11px] sm:text-xs md:sr-only">
          {shortLabel}
        </span>
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content side="right" sideOffset={8} class="hidden md:block">
      {label}
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
