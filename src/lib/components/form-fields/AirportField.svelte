<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';

  import AirportPicker from './AirportPicker.svelte';

  import CreateAirport from '$lib/components/modals/settings/pages/data-page/airport/CreateAirport.svelte';
  import * as Form from '$lib/components/ui/form';
  import { toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    field,
    form,
    labelAction,
  }: {
    field: 'from' | 'to';
    form: SuperForm<z.infer<typeof flightSchema>>;
    labelAction?: Snippet;
  } = $props();
  const { form: formData } = form;

  const isAdmin = $derived(
    hasClientPermission(page.data.authorization, 'data.airports.manage'),
  );

  let createAirport = $state(false);
</script>

<Form.Field {form} name={field} class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <div class="flex items-center justify-between gap-2">
        <Form.Label>{toTitleCase(field)} *</Form.Label>
        {@render labelAction?.()}
      </div>
      <AirportPicker
        bind:value={$formData[field]}
        placeholder="Choose an airport"
        invalid={!!props['aria-invalid']}
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
