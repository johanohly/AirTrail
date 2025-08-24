<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAirport from './CreateAirport.svelte';
  import EditAirport from './EditAirport.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import type { Airport } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { Input } from '$lib/components/ui/input';
  import CreateAircraft from '$lib/components/modals/settings/pages/data-page/aircraft/CreateAircraft.svelte';

  const {
    airports = $bindable([]),
    fetchAirports,
  }: { airports: Airport[]; fetchAirports: () => Promise<void> } = $props();

  const deleteAirport = async (code: string) => {
    const success = await api.airport.delete.mutate(code);
    if (success) {
      toast.success('Airport removed');
      await fetchAirports();
    } else {
      toast.error('Failed to remove airport');
    }
  };

  const onCreate = async (airport: Airport) => {
    airports.push(airport);
    await fetchAirports();
  };

  const filteredAirports = $derived(
    airports.filter((airport) =>
      airport.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let search = $state('');
  const handleSearch = (e: Event) => {
    search = (e.target as HTMLInputElement).value;
  };
</script>

<Collapsible
  title="Custom Airports"
  subtitle="Add airports not found in the official list."
>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search airports" />
      <CreateAirport onAirportCreate={onCreate} />
    </div>
    <div use:autoAnimate class="flex flex-col gap-4">
      {#each filteredAirports as airport (airport.code)}
        <Card level="2" class="w-full flex items-center justify-between p-3">
          <div class="flex flex-col gap-1">
            <h4 class="leading-4">{airport.name}</h4>
            <p class="text-sm">
              {#if airport.iata}
                <span class="text-muted-foreground">IATA</span>
                <b class="mr-2">{airport.iata}</b>
              {/if}
              <span class="text-muted-foreground">ICAO</span>
              <b>{airport.code}</b>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <EditAirport {airport} />
            <Confirm
              onConfirm={async () => deleteAirport(airport.code)}
              title="Remove Airport"
              description="Are you sure you want to remove this airport?"
            >
              {#snippet triggerContent({ props })}
                <Button variant="outline" size="icon" {...props}>
                  <X size="24" />
                </Button>
              {/snippet}
            </Confirm>
          </div>
        </Card>
      {:else}
        <p class="w-full pb-2 text-center text-muted-foreground">
          {#if airports.length}
            No airports found.
          {:else}
            No custom airports added.
          {/if}
        </p>
      {/each}
    </div>
  </div>
</Collapsible>
