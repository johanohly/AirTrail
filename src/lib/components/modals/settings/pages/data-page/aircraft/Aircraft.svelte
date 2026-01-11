<script lang="ts">
  import VirtualList from '@humanspeak/svelte-virtual-list';
  import { RefreshCw, LoaderCircle, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAircraft from './CreateAircraft.svelte';
  import EditAircraft from './EditAircraft.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Modal } from '$lib/components/ui/modal';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import type { Aircraft } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { aircraft = [] }: { aircraft: Aircraft[] } = $props();

  const deleteAircraft = async (id: number) => {
    const success = await api.aircraft.delete.mutate(id);
    if (success) {
      await trpc.aircraft.list.utils.invalidate();
      await trpc.flight.list.utils.invalidate();
      toast.success('Aircraft removed');
    } else {
      toast.error('Failed to remove aircraft');
    }
  };

  const filteredAircraft = $derived(
    aircraft.filter((aircraft) =>
      aircraft.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };

  let syncDialogOpen = $state(false);
  let syncing = $state(false);
  let overwrite = $state(false);

  const syncAircraft = async () => {
    syncing = true;
    try {
      const result = await api.aircraft.sync.mutate({ overwrite });
      await trpc.aircraft.list.utils.invalidate();
      let message = `Added ${result.added}, Updated ${result.updated}`;
      if (result.errors.length > 0) {
        message += ` (${result.errors.length} errors)`;
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch {
      toast.error('Failed to sync aircraft');
    } finally {
      syncing = false;
    }
  };
</script>

<Collapsible
  title="Aircraft"
  subtitle="Manage aircraft types in your database."
>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search aircraft" />
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="h-9"
          disabled={syncing}
          onclick={() => (syncDialogOpen = true)}
        >
          <RefreshCw size={16} class="shrink-0" />
          Sync
        </Button>
        <CreateAircraft />
      </div>
    </div>

    <div class="h-[40dvh]">
      <VirtualList items={filteredAircraft} itemsClass="flex flex-col gap-4">
        {#snippet renderItem(aircraftItem)}
          <Card level="2" class="w-full flex items-center justify-between p-3">
            <div class="flex flex-col gap-1">
              <h4 class="leading-4">{aircraftItem.name}</h4>
              <p class="text-sm">
                <span class="text-muted-foreground">ICAO</span>
                <b>{aircraftItem.icao ?? 'N/A'}</b>
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#key aircraftItem}
                <EditAircraft aircraft={aircraftItem} />
              {/key}
              <Confirm
                onConfirm={async () => deleteAircraft(aircraftItem.id)}
                title="Remove Aircraft"
                description="Are you sure you want to remove this aircraft? This may affect existing flight records."
              >
                {#snippet triggerContent({ props })}
                  <Button variant="outline" size="icon" {...props}>
                    <X />
                  </Button>
                {/snippet}
              </Confirm>
            </div>
          </Card>
        {/snippet}
      </VirtualList>
    </div>
  </div>
</Collapsible>

<Modal bind:open={syncDialogOpen} class="max-w-md">
  <div class="flex flex-col gap-1.5">
    <h2 class="text-lg font-semibold">Sync Aircraft</h2>
    <p class="text-sm text-muted-foreground">
      Download aircraft data from the AirTrail repository.
    </p>
  </div>

  <div class="flex flex-col gap-3 py-2">
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={overwrite} />
      Overwrite existing entries
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <Button variant="outline" disabled={syncing} onclick={syncAircraft}>
      {#if syncing}
        <LoaderCircle size={16} class="mr-2 animate-spin" />
      {/if}
      Sync Aircraft
    </Button>
  </div>
</Modal>
