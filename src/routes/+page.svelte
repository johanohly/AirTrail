<script lang="ts">
  import { trpc } from '$lib/trpc';
  import { prepareFlightData } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import {
    AddFlightModal,
    ListFlightsModal,
    SettingsModal,
    StatisticsModal,
  } from '$lib/components/modals';
  import { Map } from '$lib/components/map';
  import { openModalsState } from '$lib/stores.svelte';

  const rawFlights = trpc.flight.list.query();

  const flights = $derived.by(() => {
    const data = $rawFlights.data;
    if (!data || !data.length) return [];

    return prepareFlightData(data);
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
  {flights}
  {deleteFlight}
/>
<StatisticsModal bind:open={openModalsState.statistics} allFlights={flights} />

<Map {flights} />
