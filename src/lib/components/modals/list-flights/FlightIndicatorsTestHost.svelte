<script lang="ts">
  import FlightIndicators from './FlightIndicators.svelte';

  import { Provider as TooltipProvider } from '$lib/components/ui/tooltip';
  import type { FlightData } from '$lib/utils';

  let {
    flight,
    hasTrack = false,
    tooltips = true,
  }: {
    flight: FlightData;
    hasTrack?: boolean;
    tooltips?: boolean;
  } = $props();
</script>

<TooltipProvider>
  <FlightIndicators {flight} {hasTrack} {tooltips} />
</TooltipProvider>
