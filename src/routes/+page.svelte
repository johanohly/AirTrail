<script lang="ts">
  import { isAfter, isBefore } from 'date-fns';
  import { toast } from 'svelte-sonner';

  import {
    defaultFilters,
    type FlightFilters,
  } from '$lib/components/flight-filters/types';
  import { Map } from '$lib/components/map';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';

  const rawFlights = trpc.flight.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
  });

  let filters: FlightFilters = $state(defaultFilters);

  const filteredFlights = $derived.by(() => {
    return flights.filter((f) => {
      if (
        (filters.departureAirports.length &&
          !filters.departureAirports.includes(f.from.id.toString())) ||
        (filters.arrivalAirports.length &&
          !filters.arrivalAirports.includes(f.to.id.toString()))
      ) {
        return false;
      } else if (
        filters.fromDate &&
        isBefore(f.date, filters.fromDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      } else if (
        filters.toDate &&
        isAfter(f.date, filters.toDate.toDate(f.date.timeZone ?? 'UTC'))
      ) {
        return false;
      } else if (
        filters.aircraftRegs.length &&
        !filters.aircraftRegs.includes(f.aircraftReg || '')
      ) {
        return false;
      }
      return true;
    });
  });

  const invalidator = {
    onSuccess: () => {
      trpc.flight.list.utils.invalidate();
    },
  };
  const deleteFlightMutation = trpc.flight.delete.mutation(invalidator);

  const deleteFlight = async (id: number) => {
    const toastId = toast.loading('Deleting flight...');
    try {
      await $deleteFlightMutation.mutateAsync(id);
      toast.success('Flight deleted', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete flight', { id: toastId });
    }
  };
</script>

<ListFlightsModal
  bind:open={openModalsState.listFlights}
  bind:filters
  {flights}
  {filteredFlights}
  {deleteFlight}
/>
<StatisticsModal
  bind:open={openModalsState.statistics}
  allFlights={filteredFlights}
/>

<Map bind:filters {flights} {filteredFlights} />
