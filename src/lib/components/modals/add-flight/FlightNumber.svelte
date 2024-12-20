<script lang="ts">
  import { toast } from 'svelte-sonner';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { type FlightRoute, getFlightRoute } from '$lib/utils/adsbdb';
  import { airlineFromICAO } from '$lib/utils/data/airlines';
  import { airportFromICAO } from '$lib/utils/data/legacy_airports';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  const lookupFlight = async () => {
    if (!$formData.flightNumber) {
      return;
    }

    let route: FlightRoute | undefined = undefined;
    try {
      route = await getFlightRoute($formData.flightNumber);
    } catch (error) {
      toast.error('Flight not found');
      return;
    }
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
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Flight Number</Form.Label>
      <div class="grid grid-cols-[1fr_auto] gap-2">
        <Input bind:value={$formData.flightNumber} {...props} />
        <Button
          onclick={lookupFlight}
          disabled={!$formData.flightNumber}
          variant="secondary"
          class="h-full"
          >Search
        </Button>
      </div>
    {/snippet}
  </Form.Control>
</Form.Field>
