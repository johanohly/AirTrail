<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';

  import CreateAirport from './CreateAirport.svelte';

  import { Collapsible } from '$lib/components/ui/collapsible';
  import type { Airport } from '$lib/db/types';

  const {
    airports = $bindable([]),
    fetchAirports,
  }: { airports: Airport[]; fetchAirports: () => Promise<void> } = $props();

  const onCreate = async (airport: Airport) => {
    airports.push(airport);
    await fetchAirports();
  };
</script>

<Collapsible
  title="Custom Airports"
  subtitle="Add airports not found in the official list."
>
  <div use:autoAnimate class="flex gap-4">
    {#each airports as airport (airport.code)}
      <div class="flex items-center">
        {airport.name}
      </div>
    {:else}
      <p class="w-full pb-2 text-center text-muted-foreground">
        No custom airports added.
      </p>
    {/each}
  </div>
  <CreateAirport onAirportCreate={onCreate} />
</Collapsible>
