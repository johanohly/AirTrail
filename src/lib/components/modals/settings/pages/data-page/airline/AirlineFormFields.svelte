<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { airlineSchema } from '$lib/zod/airline';

  const { form }: { form: SuperForm<Infer<typeof airlineSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Airline Name *</Form.Label>
      <Input
        bind:value={$formData.name}
        {...props}
        placeholder="e.g., American Airlines, Delta Air Lines"
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
        placeholder="e.g., AAL, DAL"
        oninput={(e) => {
          $formData.icao = e.currentTarget.value.toUpperCase();
        }}
      />
      <Form.Description>
        The ICAO airline designation code (3 letters). Used for search and when
        importing flights.
        <HelpTooltip
          text="Examples: AAL for American Airlines, DAL for Delta Air Lines, etc."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="iata" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>IATA Code</Form.Label>
      <Input
        bind:value={$formData.iata}
        {...props}
        placeholder="e.g., AA, DL"
        oninput={(e) => {
          $formData.iata = e.currentTarget.value.toUpperCase();
        }}
      />
      <Form.Description>
        The IATA airline designation code (2 letters). Used for display and when
        importing flights.
        <HelpTooltip
          text="Examples: AA for American Airlines, DL for Delta Air Lines, etc."
        />
      </Form.Description>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
