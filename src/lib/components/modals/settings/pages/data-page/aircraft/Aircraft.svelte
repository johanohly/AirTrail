<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import CreateAircraft from './CreateAircraft.svelte';
  import EditAircraft from './EditAircraft.svelte';

  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Input } from '$lib/components/ui/input';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import type { Aircraft } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';

  const { aircraft = [] }: { aircraft: Aircraft[] } = $props();

  const deleteAircraft = async (id: number) => {
    const success = await api.aircraft.delete.mutate(id);
    if (success) {
      await trpc.aircraft.list.utils.invalidate();
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
</script>

<Collapsible
  title="Aircraft"
  subtitle="Manage aircraft types in your database."
>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2 justify-between">
      <Input oninput={handleSearch} class="h-9" placeholder="Search aircraft" />
      <CreateAircraft />
    </div>

    <ScrollArea class="h-[40dvh]">
      <div use:autoAnimate class="flex flex-col gap-4 pr-2">
        {#each filteredAircraft as aircraftItem (aircraftItem.id)}
          <Card level="2" class="w-full flex items-center justify-between p-3">
            <div class="flex flex-col gap-1">
              <h4 class="leading-4">{aircraftItem.name}</h4>
              <p class="text-sm">
                <span class="text-muted-foreground">ICAO</span>
                <b>{aircraftItem.icao ?? 'N/A'}</b>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <EditAircraft aircraft={aircraftItem} />
              <Confirm
                onConfirm={async () => deleteAircraft(aircraftItem.id)}
                title="Remove Aircraft"
                description="Are you sure you want to remove this aircraft? This may affect existing flight records."
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
            No aircraft found.
          </p>
        {/each}
      </div>
    </ScrollArea>
  </div>
</Collapsible>
