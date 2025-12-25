<script lang="ts">
  import type { Snippet } from 'svelte';

  import { getModalContext } from './Modal.svelte';

  import { cn } from '$lib/utils';
  import { isMediumScreen } from '$lib/utils/size';

  let { class: className, children }: { class?: string; children: Snippet } =
    $props();

  const ctx = getModalContext();

  // Height offsets for drawer mode
  const HEADER_HEIGHT = 150;
  const FOOTER_HEIGHT = 50;

  const maxHeight = $derived.by(() => {
    // Only apply max-height in drawer mode (mobile)
    if ($isMediumScreen) return undefined;

    const state = ctx.getState();
    let offset = 0;

    if (state.hasHeader) offset += HEADER_HEIGHT;
    if (state.hasFooter) offset += FOOTER_HEIGHT;

    if (offset === 0) offset = 100;

    return `calc(100dvh - ${offset}px)`;
  });
</script>

<div
  class={cn('px-6 py-4', { 'overflow-y-auto': maxHeight }, className)}
  style:max-height={maxHeight}
>
  {@render children()}
</div>
