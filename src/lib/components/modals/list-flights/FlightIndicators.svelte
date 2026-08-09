<script lang="ts">
  import { Clock, Route, StickyNote } from '@o7/icon/lucide';

  import {
    buildFlightIndicators,
    type FlightIndicatorKey,
  } from './flight-indicators';

  import * as Tooltip from '$lib/components/ui/tooltip';
  import { cn, type FlightData } from '$lib/utils';

  let {
    flight,
    hasTrack = false,
    size = 16,
    tooltips = true,
    class: className,
  }: {
    flight: FlightData;
    hasTrack?: boolean;
    size?: number;
    tooltips?: boolean;
    class?: string;
  } = $props();

  const icons: Record<FlightIndicatorKey, typeof Route> = {
    track: Route,
    actualTimes: Clock,
    note: StickyNote,
  };

  const indicators = $derived(buildFlightIndicators(flight, { hasTrack }));
</script>

{#if indicators.length}
  <div
    class={cn('flex items-center gap-1.5 text-muted-foreground', className)}
    data-testid="flight-indicators"
  >
    {#each indicators as indicator (indicator.key)}
      {@const Icon = icons[indicator.key]}
      {#if tooltips}
        <Tooltip.TextTooltip content={indicator.label}>
          <Icon {size} data-indicator={indicator.key} />
        </Tooltip.TextTooltip>
      {:else}
        <Icon
          {size}
          role="img"
          aria-label={indicator.label}
          data-indicator={indicator.key}
        />
      {/if}
    {/each}
  </div>
{/if}
