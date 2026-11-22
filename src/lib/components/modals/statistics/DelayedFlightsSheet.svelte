<script lang="ts">
  import DelayedFlightRow from './DelayedFlightRow.svelte';
  import DrillDownSheet from './DrillDownSheet.svelte';

  import {
    DELAY_THRESHOLD_MINUTES,
    punctualityReport,
  } from '$lib/stats/punctuality';
  import { pluralize, type FlightData } from '$lib/utils';

  let {
    flights,
    onBack,
    onOpenFlight,
  }: {
    flights: FlightData[];
    onBack: () => void;
    onOpenFlight?: (flightId: number) => void;
  } = $props();

  const report = $derived(punctualityReport(flights));
  const subtitle = $derived(
    `${report.delayedFlights} of ${report.assessedFlights} assessed ${pluralize(report.assessedFlights, 'flight')} landed more than ${DELAY_THRESHOLD_MINUTES} minutes late.`,
  );
</script>

<DrillDownSheet title="Delayed flights" {subtitle} {onBack}>
  <div class="space-y-0.5">
    {#each report.delays as delay (delay.flight.id)}
      <DelayedFlightRow
        {delay}
        largest={report.worstDelayMinutes}
        onclick={onOpenFlight && (() => onOpenFlight(delay.flight.id))}
      />
    {:else}
      <p class="py-3 text-sm text-muted-foreground">No delayed flights</p>
    {/each}
  </div>
</DrillDownSheet>
