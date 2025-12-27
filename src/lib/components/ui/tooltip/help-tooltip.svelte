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
      class="prose prose-sm prose-neutral dark:prose-invert max-w-[min(100dvw,_20rem)] text-pretty px-4 py-2 text-center leading-snug transition-all prose-a:cursor-alias prose-a:underline prose-a:decoration-dotted prose-a:underline-offset-2 prose-code:inline-block prose-code:leading-none prose-p:my-0 prose-ul:my-2 prose-ol:my-2"
    >
      {#if content}
        {@render content()}
      {:else}
        {text}
      {/if}
    </div>
  </Popover.Content>
</Popover.Root>
