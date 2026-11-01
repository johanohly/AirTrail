<script lang="ts">
  import { ChevronLeft, X } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';

  import { Button } from '$lib/components/ui/button';

  let {
    title,
    subtitle,
    onBack,
    children,
  }: {
    title: string;
    subtitle: string;
    onBack: () => void;
    children: Snippet;
  } = $props();
</script>

<!-- The modal's own overlay handles dismissing; this only returns to the page. -->
<button
  type="button"
  aria-label="Back to statistics"
  tabindex="-1"
  class="absolute inset-0 z-10 hidden cursor-default bg-black/30 animate-in fade-in-0 duration-150 md:block dark:bg-black/60"
  onclick={onBack}
></button>
<div
  class="absolute inset-y-0 right-0 z-10 w-full overflow-y-auto bg-background p-4 animate-in slide-in-from-right-4 fade-in-0 duration-200 motion-reduce:animate-none md:w-[520px] md:border-l md:p-6 md:shadow-xl"
  data-testid="statistics-drill-down"
>
  <div class="flex items-center justify-between">
    <Button
      variant="ghost"
      size="sm"
      class="-ml-2 gap-1 text-muted-foreground"
      onclick={onBack}
    >
      <ChevronLeft size={16} />
      Statistics
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="hidden text-muted-foreground md:inline-flex"
      aria-label="Back to statistics"
      onclick={onBack}
    >
      <X size={16} />
    </Button>
  </div>
  <h2 class="mt-2 text-2xl font-bold tracking-tight">{title}</h2>
  <p class="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
  <div class="mt-3">
    {@render children()}
  </div>
</div>
