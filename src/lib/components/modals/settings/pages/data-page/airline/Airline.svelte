<script lang="ts">
  import SvelteVirtualList from '@humanspeak/svelte-virtual-list';
  import { Download, LoaderCircle, SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAirline from './CreateAirline.svelte';
  import EditAirline from './EditAirline.svelte';

  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';
  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import type { Airline } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { airlines = [] }: { airlines: Airline[] } = $props();

  // Single shared edit state
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

  let importingIcons = $state(false);
  let importDialogOpen = $state(false);

  const importDefaultIcons = async (overwrite: boolean) => {
    importingIcons = true;
    try {
      const count = await api.airline.importDefaultIcons.mutate({ overwrite });
      importDialogOpen = false;
      if (count > 0) {
        await trpc.airline.list.utils.invalidate();
        toast.success(`Imported ${count} icon${count === 1 ? '' : 's'}`);
      } else {
        toast.info('No new icons to import');
      }
    } catch {
      toast.error('Failed to import icons');
    } finally {
      importingIcons = false;
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
          disabled={importingIcons}
          onclick={() => (importDialogOpen = true)}
        >
          {#if importingIcons}
            <LoaderCircle size={16} class="mr-2 animate-spin" />
            Importing...
          {:else}
            <Download size={16} class="mr-2" />
            Import Icons
          {/if}
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

<Dialog.Root bind:open={importDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Import Default Icons</Dialog.Title>
      <Dialog.Description>
        Download airline icons from the AirTrail repository for airlines that
        have a matching ICAO code.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-2">
      <Button
        variant="outline"
        disabled={importingIcons}
        onclick={() => importDefaultIcons(false)}
      >
        {#if importingIcons}
          <LoaderCircle size={16} class="mr-2 animate-spin" />
        {/if}
        Fill missing icons only
      </Button>
      <Button
        variant="outline"
        disabled={importingIcons}
        onclick={() => importDefaultIcons(true)}
      >
        {#if importingIcons}
          <LoaderCircle size={16} class="mr-2 animate-spin" />
        {/if}
        Overwrite all with defaults
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
