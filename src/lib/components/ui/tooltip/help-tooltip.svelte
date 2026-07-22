<script lang="ts">
  import { CircleQuestionMark } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  import * as Popover from '$lib/components/ui/popover';

  const {
    text,
    content,
    children,
  }: {
    text?: string;
    content?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<Popover.Root>
  <Popover.Trigger title="Click to view tooltip" class="text-muted-foreground">
    {#if children}
      {@render children()}
    {:else}
      <CircleQuestionMark size={16} />
    {/if}
  </Popover.Trigger>
  <Popover.Content
    side="top"
    class="p-0 pointer-events-auto z-[99] items-center overflow-hidden rounded-md border shadow-sm"
  >
    <div
      class="max-w-[min(100dvw,_20rem)] px-4 py-2 text-center text-sm leading-snug text-foreground text-pretty transition-all [&_a]:cursor-alias [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 [&_a:focus-visible]:rounded-xs [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-ring [&_code]:inline-block [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125em] [&_code]:font-semibold [&_code]:leading-none [&_p]:my-0 [&_strong]:font-semibold"
    >
      {#if content}
        {@render content()}
      {:else}
        {text}
      {/if}
    </div>
  </Popover.Content>
</Popover.Root>
