<script lang="ts">
  import SvelteVirtualList from '@humanspeak/svelte-virtual-list';
  import { RefreshCw, LoaderCircle, SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAirline from './CreateAirline.svelte';
  import EditAirline from './EditAirline.svelte';

  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';
  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Modal } from '$lib/components/ui/modal';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import type { Airline } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { airlines = [] }: { airlines: Airline[] } = $props();

  let editOpen = $state(false);
  let airlineToEdit = $state<Airline | null>(null);

  const openEdit = (airline: Airline) => {
    airlineToEdit = airline;
    editOpen = true;
  };

  const deleteAirline = async (airline: Airline) => {
    const confirmed = await confirmation.show({
      title: 'Remove Airline',
      description: `Are you sure you want to remove ${airline.name}?`,
    });
    if (!confirmed) return;

    const success = await api.airline.delete.mutate(airline.id);
    if (success) {
      await trpc.airline.list.utils.invalidate();
      await trpc.flight.list.utils.invalidate();
      toast.success('Airline removed');
    } else {
      toast.error('Failed to remove airline');
    }
  };

  const filteredAirlines = $derived(
    airlines.filter((airline) =>
      airline.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };

  let syncDialogOpen = $state(false);
  let syncing = $state(false);
  let syncingIcons = $state(false);
  let overwrite = $state(false);
  let includeDefunct = $state(false);

  const syncAirlines = async () => {
    syncing = true;
    try {
      const result = await api.airline.sync.mutate({
        overwrite,
        includeDefunct,
      });
      await trpc.airline.list.utils.invalidate();
      let message = `Added ${result.added}, Updated ${result.updated}`;
      if (result.errors.length > 0) {
        message += ` (${result.errors.length} errors)`;
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch {
      toast.error('Failed to sync airlines');
    } finally {
      syncing = false;
    }
  };

  const syncIcons = async () => {
    syncingIcons = true;
    try {
      const result = await api.airline.syncIcons.mutate({ overwrite });
      await trpc.airline.list.utils.invalidate();
      let message = `Synced ${result.synced} icons`;
      if (result.errors.length > 0) {
        message += ` (${result.errors.length} errors)`;
        toast.warning(message);
      } else if (result.synced === 0) {
        toast.info('No icons to sync');
      } else {
        toast.success(message);
      }
    } catch {
      toast.error('Failed to sync icons');
    } finally {
      syncingIcons = false;
    }
  };
</script>

<Collapsible title="Airlines" subtitle="Manage airlines in your database.">
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search airlines" />
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="h-9"
          disabled={syncing || syncingIcons}
          onclick={() => (syncDialogOpen = true)}
        >
          <RefreshCw size={16} class="shrink-0" />
          Sync
        </Button>
        <CreateAirline withoutTrigger={false} />
      </div>
    </div>
    <div class="h-[40dvh]">
      <SvelteVirtualList
        items={filteredAirlines}
        itemsClass="flex flex-col gap-2"
      >
        {#snippet renderItem(airline)}
          <Card level="2" class="w-full flex items-center justify-between p-3">
            <div class="flex items-center gap-3">
              <AirlineIcon {airline} size={32} />
              <div class="flex flex-col">
                <span class="font-medium">{airline.name}</span>
                <div class="flex gap-4 text-sm text-muted-foreground">
                  {#if airline.iata}
                    <span>IATA: <b>{airline.iata}</b></span>
                  {/if}
                  {#if airline.icao}
                    <span>ICAO: <b>{airline.icao}</b></span>
                  {/if}
                </div>
              </div>
            </div>
            <div class="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onclick={() => openEdit(airline)}
              >
                <SquarePen size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onclick={() => deleteAirline(airline)}
              >
                <X />
              </Button>
            </div>
          </Card>
        {/snippet}
      </SvelteVirtualList>
    </div>
  </div>
</Collapsible>

<EditAirline airline={airlineToEdit} bind:open={editOpen} />

<Modal bind:open={syncDialogOpen} class="max-w-md">
  <div class="flex flex-col gap-1.5">
    <h2 class="text-lg font-semibold">Sync Airlines</h2>
    <p class="text-sm text-muted-foreground">
      Download airline data and icons from the AirTrail repository.
    </p>
  </div>

  <div class="flex flex-col gap-3 py-2">
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={overwrite} />
      Overwrite existing entries
    </label>
    <label class="flex items-center gap-2 text-sm">
      <Checkbox bind:checked={includeDefunct} />
      Include defunct airlines
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <Button variant="outline" disabled={syncing} onclick={syncAirlines}>
      {#if syncing}
        <LoaderCircle size={16} class="mr-2 animate-spin" />
      {/if}
      Sync Airlines
    </Button>
    <Button variant="outline" disabled={syncingIcons} onclick={syncIcons}>
      {#if syncingIcons}
        <LoaderCircle size={16} class="mr-2 animate-spin" />
      {/if}
      Sync Icons
    </Button>
  </div>
</Modal>
