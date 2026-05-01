<script lang="ts">
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import { mapDetailsState } from '$lib/state.svelte';
  import type { FlightData } from '$lib/utils';

  import AirportDetailsContent from './AirportDetailsContent.svelte';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();

  const selection = $derived(mapDetailsState.selection);
</script>

{#if selection?.type === 'airport'}
  <AirportDetailsContent {flights} bind:filters bind:tempFilters />
{/if}
