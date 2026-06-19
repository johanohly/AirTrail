<script lang="ts">
  import { Funnel } from '@o7/icon/lucide';

  import Filters from './Filters.svelte';
  import MobileFiltersModal from './MobileFiltersModal.svelte';

  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import { Button } from '$lib/components/ui/button';
  import { isMediumScreen } from '$lib/utils/size';
  import type { FlightData } from '$lib/utils';

  let {
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();

  let drawerOpen = $state(false);

  const filtersApplied = $derived(
    hasTempFilters ||
      filters.departureAirports.length > 0 ||
      filters.arrivalAirports.length > 0 ||
      filters.airportsEither.length > 0 ||
      filters.routes.length > 0 ||
      filters.years.length > 0 ||
      !!filters.fromDate ||
      !!filters.toDate ||
      filters.passengers.length > 0 ||
      filters.airline.length > 0 ||
      filters.aircraft.length > 0 ||
      filters.aircraftRegs.length > 0,
  );
</script>

{#if $isMediumScreen}
  <Filters {flights} bind:filters bind:tempFilters {hasTempFilters} />
{:else}
  <span class="relative inline-flex">
    <Button
      variant="outline"
      size="sm"
      class="gap-2"
      disabled={flights.length === 0}
      onclick={() => (drawerOpen = true)}
    >
      <Funnel size={16} />
      Filters
    </Button>
    {#if filtersApplied}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute -right-1 -top-1 size-2.5 rounded-full bg-blue-500 ring-2 ring-background"
      ></span>
    {/if}
  </span>

  <MobileFiltersModal
    bind:open={drawerOpen}
    {flights}
    bind:filters
    bind:tempFilters
    {hasTempFilters}
  />
{/if}
