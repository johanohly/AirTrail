<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import { Input } from '$lib/components/ui/input';
  import type { flightSchema } from '$lib/zod/flight';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { airportFromICAO } from '$lib/utils/data/airports';
  import { airlineFromICAO } from '$lib/utils/data/airlines';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  const lookupFlight = async () => {
    const resp = await fetch(
      `https://api.adsbdb.com/v0/callsign/${$formData.flightNumber}`,
    );
    if (!resp.ok) {
      toast.error('Flight not found');
      return;
    }

    const data = await resp.json();
    if (!data.response.flightroute) {
      toast.error('Flight not found');
      return;
    }

    const route = data.response.flightroute;
    const origin = airportFromICAO(route.origin.icao_code);
    const destination = airportFromICAO(route.destination.icao_code);
    const airline = airlineFromICAO(route.airline.icao);

    if (!origin || !destination || !airline) {
      toast.error('Flight not found');
      return;
    }

    if (
      ($formData.from !== '' || $formData.to !== '') &&
      !confirm(
        'Are you sure you want to overwrite the current flight information?',
      )
    ) {
      return;
    }

    $formData.from = origin.ICAO;
    $formData.to = destination.ICAO;
    $formData.airline = airline.icao;
    toast.success('Flight found');
  };
</script>

<Form.Field {form} name="flightNumber">
  <Form.Control let:attrs>
    <Form.Label>Flight Number</Form.Label>
    <div class="grid grid-cols-[1fr_auto] gap-2">
      <Input bind:value={$formData.flightNumber} {...attrs} />
      <Button
        onclick={lookupFlight}
        disabled={!$formData.flightNumber}
        variant="secondary"
        class="h-full"
        >Search
      </Button>
    </div>
  </Form.Control>
</Form.Field>
