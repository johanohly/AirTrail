<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import AirportPicker from './AirportPicker.svelte';

  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import * as Form from '$lib/components/ui/form';
  import { toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    field,
    form,
  }: {
    field: 'from' | 'to';
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;

  let createAirport = $state(false);
</script>

<Form.Field {form} name={field} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>{toTitleCase(field)} *</Form.Label>
      <AirportPicker
        bind:value={$formData[field]}
        placeholder="Select an airport"
        onCreateNew={() => (createAirport = true)}
      />
      <input hidden bind:value={$formData[field]} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<CreateAirport bind:open={createAirport} withoutTrigger />
