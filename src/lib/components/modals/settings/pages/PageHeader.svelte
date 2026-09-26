<script lang="ts">
  /* eslint svelte/no-at-html-tags: 0 */
  import type { Snippet } from 'svelte';

  import { Separator } from '$lib/components/ui/separator';

  let {
    title,
    subtitle,
    subtitleHtml,
    headerRight,
    children,
  }: {
    title: string;
    subtitle?: string;
    subtitleHtml?: Snippet;
    headerRight?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="space-y-6">
  <div
    class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="min-w-0">
      <h3 class="text-lg font-medium">{title}</h3>
      {#if subtitleHtml}
        {@render subtitleHtml()}
      {:else if subtitle}
        <p class="text-muted-foreground text-sm">
          {@html subtitle}
        </p>
      {/if}
    </div>
    {#if headerRight}
      <div class="shrink-0">{@render headerRight()}</div>
    {/if}
  </div>
  <Separator />

  {@render children()}
</div>
