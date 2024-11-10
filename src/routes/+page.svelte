<script lang="ts">
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import { ListFlightsModal, StatisticsModal } from '$lib/components/modals';
  import { Map } from '$lib/components/map';
  import { filteredMapFlightsState, openModalsState } from '$lib/stores.svelte';

  const rawFlights = trpc.flight.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
  });

  $effect(() => {
    filteredMapFlightsState.flightData = flights;
  })

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
  {flights}
  {deleteFlight}
/>
<StatisticsModal bind:open={openModalsState.statistics} allFlights={filteredMapFlightsState.flightData} />

<Map flights={filteredMapFlightsState.flightData} />
