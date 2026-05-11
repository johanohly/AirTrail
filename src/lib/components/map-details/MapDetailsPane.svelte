<script lang="ts">
  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import type { FlightData } from '$lib/utils';

  import AirportDetailsContent from './AirportDetailsContent.svelte';
  import RouteDetailsContent from './RouteDetailsContent.svelte';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
  }: {
    flights: FlightData[];
    filters?: FlightFilters;
    tempFilters?: TempFilters;
  } = $props();
</script>

<AirportDetailsContent {flights} bind:filters bind:tempFilters />
<RouteDetailsContent {flights} bind:filters bind:tempFilters />
