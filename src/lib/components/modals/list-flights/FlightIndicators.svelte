<script lang="ts">
  import { Clock, Route, StickyNote, Users } from '@o7/icon/lucide';

  import type {
    FlightIndicator,
    FlightIndicatorKey,
  } from './flight-indicators';

  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn } from '$lib/utils';

  let {
    indicators,
    class: className,
  }: {
    indicators: FlightIndicator[];
    class?: string;
  } = $props();

  const icons: Record<FlightIndicatorKey, typeof Route> = {
    track: Route,
    actualTimes: Clock,
    passengers: Users,
    note: StickyNote,
  };
</script>

{#snippet indicatorIcon(indicator: FlightIndicator)}
  {@const Icon = icons[indicator.key]}
  <Icon size={16} aria-hidden="true" data-indicator={indicator.key} />
{/snippet}

{#if indicators.length}
  <div
    class={cn('flex items-center gap-1.5 text-muted-foreground', className)}
    data-testid="flight-indicators"
  >
    {#each indicators as indicator (indicator.key)}
      <Tooltip.Root disableHoverableContent>
        <Tooltip.Trigger
          aria-label={indicator.label}
          class="inline-flex rounded-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {@render indicatorIcon(indicator)}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            class="max-w-[min(20rem,var(--bits-tooltip-content-available-width))] whitespace-normal break-words"
          >
            {indicator.label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    {/each}
  </div>
{/if}
