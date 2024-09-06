<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import type { Snippet } from 'svelte';

  let {
    title,
    subtitle,
    children,
    headerRight,
  }: {
    title: string;
    subtitle: string;
    children: Snippet;
    headerRight?: Snippet;
  } = $props();
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-medium">{title}</h3>
      <p class="text-muted-foreground text-sm">
        {subtitle}
      </p>
    </div>
    {#if headerRight}
      {@render headerRight()}
    {/if}
  </div>
  <Separator />

  {@render children()}
</div>
