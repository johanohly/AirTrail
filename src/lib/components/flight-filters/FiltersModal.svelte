<script lang="ts">
  import Filters from './Filters.svelte';

  import type {
    FlightFilters,
    TempFilters,
  } from '$lib/components/flight-filters/types';
  import { Modal, ModalBody, ModalHeader } from '$lib/components/ui/modal';
  import type { FlightData } from '$lib/utils';

  let {
    open = $bindable(),
    flights,
    filters = $bindable(),
    tempFilters = $bindable(),
    hasTempFilters = false,
  }: {
    open: boolean;
    flights: FlightData[];
    filters: FlightFilters;
    tempFilters?: TempFilters;
    hasTempFilters?: boolean;
  } = $props();
</script>

<Modal bind:open class="max-w-lg">
  <ModalHeader class="pb-2">
    <h2 class="text-lg font-medium">Filters</h2>
  </ModalHeader>
  <ModalBody class="overflow-x-hidden pt-2">
    <Filters
      {flights}
      bind:filters
      bind:tempFilters
      {hasTempFilters}
      layout="stacked"
    />
  </ModalBody>
</Modal>
