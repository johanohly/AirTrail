<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';

  let {
    text,
    class: className,
    delayDuration = 0,
  }: {
    text: string;
    class?: string;
    delayDuration?: number;
  } = $props();
  let open = $state(false);

  let trigger: HTMLParagraphElement;
  $effect(() => {
    if (open) {
      if (trigger.scrollWidth <= trigger.clientWidth) {
        open = false;
      }
    }
  });
</script>

<Tooltip.Root bind:open {delayDuration}>
  <Tooltip.Trigger
    class={cn('text-left', { 'select-text cursor-text': !open })}
  >
    <p bind:this={trigger} class={className}>{text}</p>
  </Tooltip.Trigger>
  <Tooltip.Content>
    {text}
  </Tooltip.Content>
</Tooltip.Root>
