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
  import type { Aircraft } from '$lib/db/types';
  import { api } from '$lib/trpc';

  const {
    aircraft = $bindable([]),
    fetchAircraft,
  }: { aircraft: Aircraft[]; fetchAircraft: () => Promise<void> } = $props();

  const deleteAircraft = async (icao: string) => {
    const success = await api.aircraft.delete.mutate(icao);
    if (success) {
      toast.success('Aircraft removed');
      await fetchAircraft();
    } else {
      toast.error('Failed to remove aircraft');
    }
  };

  const onCreate = async (newAircraft: Aircraft) => {
    aircraft.push(newAircraft);
    await fetchAircraft();
  };
</script>

<Collapsible
  title="Aircraft"
  subtitle="Manage aircraft types in your database."
>
  <div use:autoAnimate class="flex flex-col gap-4">
    {#each aircraft as aircraftItem (aircraftItem.icao)}
      <Card level="2" class="w-full flex items-center justify-between p-3">
        <div class="flex flex-col gap-1">
          <h4 class="leading-4">{aircraftItem.name}</h4>
          <p class="text-sm">
            <span class="text-muted-foreground">ICAO</span>
            <b>{aircraftItem.icao}</b>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <EditAircraft aircraft={aircraftItem} />
          <Confirm
            onConfirm={async () => deleteAircraft(aircraftItem.icao)}
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
  <CreateAircraft onAircraftCreate={onCreate} />
</Collapsible>