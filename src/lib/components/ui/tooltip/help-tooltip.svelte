<script lang="ts">
  import { Info } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  import * as Popover from '$lib/components/ui/popover/index.js';

  const {
    text,
    children,
  }: {
    text: string;
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
  <Popover.Content side="top">
    {text}
  </Popover.Content>
</Popover.Root>
