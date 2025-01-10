<script lang="ts">
  import { REGEXP_ONLY_CHARS } from 'bits-ui';
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import LocationField from './LocationField.svelte';
  import TimezoneField from './TimezoneField.svelte';

  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as InputOTP from '$lib/components/ui/input-otp';
  import * as Select from '$lib/components/ui/select';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import { AirportTypes } from '$lib/db/types';
  import { snakeToTitleCase } from '$lib/utils/string.js';
  import type { airportSchema } from '$lib/zod/airport';

  const { form }: { form: SuperForm<Infer<typeof airportSchema>> } = $props();

  const { form: formData } = form;
</script>

<Form.Field {form} name="name" class="flex flex-col">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Name *</Form.Label>
      <Input bind:value={$formData.name} {...props} />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<Form.Field {form} name="type">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Type *</Form.Label>
      <Select.Root bind:value={$formData.type} name={props.name} type="single">
        <Select.Trigger {...props}>
          {$formData.type ? snakeToTitleCase($formData.type) : 'Select a type'}
        </Select.Trigger>
        <Select.Content>
          {#each AirportTypes as type}
            <Select.Item value={type} label={snakeToTitleCase(type)} />
          {/each}
        </Select.Content>
      </Select.Root>
      <Form.Description
        >Purely for sorting purposes. <HelpTooltip
          text={'For reference, Dubai International Airport is a "large airport", while Nuuk Airport is a "medium airport".'}
        /></Form.Description
      >
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<section class="grid grid-cols-2 gap-2">
  <Form.Field {form} name="code" class="flex flex-col">
    <Form.Control>
      {#snippet children()}
        <Form.Label>ICAO *</Form.Label>
        <InputOTP.Root
          value={$formData.code}
          onValueChange={(v) => {
            $formData.code = v.toUpperCase();
          }}
          pattern={REGEXP_ONLY_CHARS}
          maxlength={4}
        >
          {#snippet children({ cells })}
            <InputOTP.Group>
              {#each cells as cell}
                <InputOTP.Slot {cell} class="font-bold text-base" />
              {/each}
            </InputOTP.Group>
          {/snippet}
        </InputOTP.Root>
        <Form.Description>
          The ICAO code of the airport.
          <HelpTooltip
            text="Technically speaking, the only requirement is that it is a unique four-letter code."
          />
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="iata" class="flex flex-col">
    <Form.Control>
      {#snippet children()}
        <Form.Label>IATA</Form.Label>
        <InputOTP.Root
          value={$formData.iata}
          onValueChange={(v) => {
            $formData.iata = v.toUpperCase();
          }}
          pattern={REGEXP_ONLY_CHARS}
          maxlength={3}
        >
          {#snippet children({ cells })}
            <InputOTP.Group>
              {#each cells as cell}
                <InputOTP.Slot {cell} class="font-bold text-base" />
              {/each}
            </InputOTP.Group>
          {/snippet}
        </InputOTP.Root>
        <Form.Description>
          The IATA code of the airport. <HelpTooltip
            text="Will only be used for display purposes
          and airport autocomplete."
          />
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</section>

<LocationField {form} />
<TimezoneField {form} />
