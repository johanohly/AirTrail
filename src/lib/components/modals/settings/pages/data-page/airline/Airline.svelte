<script lang="ts">
  import SvelteVirtualList from '@humanspeak/svelte-virtual-list';
  import { SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAirline from './CreateAirline.svelte';
  import EditAirline from './EditAirline.svelte';

  import AirlineIcon from '$lib/components/display/AirlineIcon.svelte';
  import { confirmation } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
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
</script>

<Collapsible title="Airlines" subtitle="Manage airlines in your database.">
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search airlines" />
      <CreateAirline />
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
