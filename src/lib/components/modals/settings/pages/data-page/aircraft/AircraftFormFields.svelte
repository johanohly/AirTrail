<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { aircraftSchema } from '$lib/zod/aircraft';

  const { form }: { form: SuperForm<Infer<typeof aircraftSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Aircraft Name *</Form.Label>
      <Input
        bind:value={$formData.name}
        {...props}
        placeholder="e.g., Airbus A320, Boeing 737-800"
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="icao" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>ICAO Code</Form.Label>
      <Input
        bind:value={$formData.icao}
        {...props}
        placeholder="e.g., A320, B738"
        oninput={(e) => {
          $formData.icao = e.currentTarget.value.toUpperCase();
        }}
      />
      <Form.Description>
        The ICAO aircraft type designation code. Used for search and when
        importing flights.
        <HelpTooltip
          text="Examples: A320 for Airbus A320, B738 for Boeing 737-800, etc."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
