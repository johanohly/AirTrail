<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';

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

  const isAdmin = $derived(page.data.user?.role !== 'user');

  let createAirport = $state(false);
</script>

<Form.Field {form} name={field} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>{toTitleCase(field)} *</Form.Label>
      <AirportPicker
        bind:value={$formData[field]}
        placeholder="Choose an airport"
        onCreateNew={isAdmin ? () => (createAirport = true) : undefined}
      />
      <input hidden bind:value={$formData[field]} name={props.name} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

{#if isAdmin}
  <CreateAirport bind:open={createAirport} withoutTrigger />
{/if}
