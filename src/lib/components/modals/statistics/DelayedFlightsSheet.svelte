<script lang="ts">
  import DelayedFlightRow from './DelayedFlightRow.svelte';
  import DrillDownSheet from './DrillDownSheet.svelte';

  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
  } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';
  import { pluralize } from '$lib/utils';

  let {
    flights,
    onBack,
    onOpenFlight,
  }: {
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const report = $derived(
    punctualityReport(flights, { flightLimit: Number.POSITIVE_INFINITY }),
  );
  const largest = $derived(report.worstDelays[0]?.delayMinutes || 1);
  const subtitle = $derived(
    `${report.delayedFlights} of ${report.assessedFlights} assessed ${pluralize(report.assessedFlights, 'flight')} landed more than ${DELAY_THRESHOLD_MINUTES} minutes late.`,
  );
</script>

<DrillDownSheet title="Delayed flights" {subtitle} {onBack}>
  <div class="space-y-0.5">
    {#each report.worstDelays as delay (delay.flight.id)}
      <DelayedFlightRow
        {delay}
        {largest}
        onclick={() => onOpenFlight?.(delay.flight.id)}
      />
    {:else}
      <p class="py-3 text-sm text-muted-foreground">
        Every assessed flight arrived on time.
      </p>
    {/each}
  </div>
</DrillDownSheet>
