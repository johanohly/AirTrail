<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import SeatInformation from '$lib/components/modals/addFlight/SeatInformation.svelte';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import type { addFlightSchema } from '$lib/zod/flight';
  import type { Writable } from 'svelte/store';
  import FlightInformation from '$lib/components/modals/addFlight/FlightInformation.svelte';

  let {
    form,
    formData,
  }: {
    form: SuperForm<z.infer<typeof addFlightSchema>>;
    formData: Writable<z.infer<typeof addFlightSchema>>;
  } = $props();
</script>

<Accordion.Root>
  <SeatInformation {form} {formData} />
  <FlightInformation {form} {formData} />
</Accordion.Root>
