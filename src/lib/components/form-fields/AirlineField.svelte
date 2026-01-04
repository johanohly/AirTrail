<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import AirlinePicker from './AirlinePicker.svelte';

  import CreateAirline from '$lib/components/modals/settings/pages/data-page/airline/CreateAirline.svelte';
  import * as Form from '$lib/components/ui/form';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  let createAirline = $state(false);
</script>

<Form.Field {form} name="airline" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Airline</Form.Label>
      <AirlinePicker
        bind:value={$formData.airline}
        placeholder="Select airline"
        onCreateNew={() => (createAirline = true)}
      />
      <input hidden bind:value={$formData.airline} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<CreateAirline bind:open={createAirline} withoutTrigger />
