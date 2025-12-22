<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  import * as Popover from '$lib/components/ui/popover/index.js';

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
  <Popover.Trigger title="Click to view tooltip">
    {#if children}
      {@render children()}
    {:else}
      <Info size="15" />
    {/if}
  </Popover.Trigger>
  <Popover.Content side="top" class="z-50 overflow-hidden rounded-md border px-3 py-1.5 text-sm shadow-md">
    {#if content}
      {@render content()}
    {:else}
      {text}
    {/if}
  </Popover.Content>
</Popover.Root>
