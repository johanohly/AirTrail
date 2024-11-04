<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    href,
    label,
    children,
  }: { href: string; label: string; children: Snippet } = $props();
</script>

<div
  class="size-[58px] p-2 flex items-center justify-center rounded-2xl border bg-background/70 backdrop-blur-md"
>
  <a {href}>
    <div
      class="flex aspect-square cursor-pointer items-center justify-center rounded-full"
    >
      <Tooltip.Root delayDuration={0}>
        <Tooltip.Trigger
          class="hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 transition-all duration-200 rounded-full p-3 mx-0"
        >
          {@render children()}
        </Tooltip.Trigger>
        <Tooltip.Content sideOffset={8}>
          <p>{label}</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </div>
  </a>
</div>
