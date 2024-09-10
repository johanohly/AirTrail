<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import SeatInformation from '$lib/components/modals/add-flight/SeatInformation.svelte';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import FlightInformation from '$lib/components/modals/add-flight/FlightInformation.svelte';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
</script>

<Accordion.Root>
  <SeatInformation {form} />
  <FlightInformation {form} />
</Accordion.Root>
