<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';

  let {
    text,
    classes,
    openDelay = 0,
  }: {
    text: string;
    classes?: string;
    openDelay?: number;
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

<Tooltip.Root bind:open {openDelay}>
  <Tooltip.Trigger
    class={cn('text-left', { 'select-text cursor-text': !open })}
  >
    <p bind:this={trigger} class={classes}>{text}</p>
  </Tooltip.Trigger>
  <Tooltip.Content>
    {text}
  </Tooltip.Content>
</Tooltip.Root>
