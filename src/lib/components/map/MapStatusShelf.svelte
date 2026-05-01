<script lang="ts">
  import { Undo2, X } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';

  let {
    showPreviousView = false,
    activeAirportFilter = null,
    activeRouteFilter = null,
    showScopeBanner = false,
    alignWithDetails = false,
    onPreviousView,
    onClearAirportFilter,
    onClearRouteFilter,
  }: {
    showPreviousView?: boolean;
    activeAirportFilter?: { id: string; label: string } | null;
    activeRouteFilter?: { id: string; label: string } | null;
    showScopeBanner?: boolean;
    alignWithDetails?: boolean;
    onPreviousView?: () => void;
    onClearAirportFilter?: () => void;
    onClearRouteFilter?: () => void;
  } = $props();

  const visible = $derived(
    showPreviousView || !!activeAirportFilter || !!activeRouteFilter,
  );
</script>

{#if visible}
  <div
    class={cn(
      'pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-3 transition-[top,left] duration-200',
      showScopeBanner ? 'top-[4.5rem]' : 'top-3',
      alignWithDetails ? 'md:left-[calc(50%+12rem)]' : '',
    )}
    aria-label="Map status"
  >
    {#if showPreviousView && onPreviousView}
      <Button
        variant="outline"
        size="sm"
        class="pointer-events-auto h-8 border-border/70 bg-background/90 px-2.5 text-xs shadow-xs backdrop-blur-md"
        onclick={onPreviousView}
      >
        <Undo2 size={14} />
        Back to previous view
      </Button>
    {/if}

    {#if activeAirportFilter && onClearAirportFilter}
      <Button
        variant="outline"
        size="sm"
        class="pointer-events-auto h-8 border-border/70 bg-background/90 px-2.5 text-xs shadow-xs backdrop-blur-md"
        onclick={onClearAirportFilter}
        aria-label="Clear airport filter"
      >
        <span>Filtered: {activeAirportFilter.label}</span>
        <X size={13} />
      </Button>
    {/if}

    {#if activeRouteFilter && onClearRouteFilter}
      <Button
        variant="outline"
        size="sm"
        class="pointer-events-auto h-8 border-border/70 bg-background/90 px-2.5 text-xs shadow-xs backdrop-blur-md"
        onclick={onClearRouteFilter}
        aria-label="Clear route filter"
      >
        <span>Filtered: {activeRouteFilter.label}</span>
        <X size={13} />
      </Button>
    {/if}
  </div>
{/if}
