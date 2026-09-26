<script lang="ts">
  import type { Infer, SuperForm } from 'sveltekit-superforms';

  import AircraftPicker from '$lib/components/form-fields/AircraftPicker.svelte';
  import DateField from '$lib/components/form-fields/DateField.svelte';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { HelpTooltip } from '$lib/components/ui/tooltip';
  import type { Aircraft } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import type { aircraftSchema } from '$lib/zod/aircraft';

  const { form }: { form: SuperForm<Infer<typeof aircraftSchema>> } = $props();

  const { form: formData } = form;

  let type: Aircraft | null = $state(null);

  $effect(() => {
    const typeId = $formData.typeId;
    if (typeId === null) {
      type = null;
    } else if (type?.id !== typeId) {
      void api.aircraft.get.query(typeId).then((result) => {
        if ($formData.typeId === typeId) type = result;
      });
    }
  });

  const setType = (value: Aircraft | null) => {
    $formData.typeId = value?.id ?? null;
    if (!value) return;
    // Specific aircraft usually share their type's name and code
    if (!$formData.name) $formData.name = value.name;
    if (!$formData.icao) $formData.icao = value.icao;
  };
</script>

<Form.Field
  {form}
  name="specific"
  class="flex flex-row items-center justify-between gap-4"
>
  <Form.Control>
    {#snippet children({ props })}
      <div class="grid gap-1">
        <Form.Label>Specific aircraft</Form.Label>
        <Form.Description>
          A single airframe (tracked by serial number) rather than a generic
          aircraft type.
        </Form.Description>
      </div>
      <Switch bind:checked={$formData.specific} {...props} />
    {/snippet}
  </Form.Control>
</Form.Field>

{#if $formData.specific}
  <Form.Field {form} name="typeId" class="flex flex-col">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Aircraft Type</Form.Label>
        <AircraftPicker
          value={type}
          typesOnly
          placeholder="Search aircraft types"
          onchange={setType}
        />
        <input hidden value={$formData.typeId ?? ''} name={props.name} />
        <Form.Description>
          The generic aircraft type of this airframe.
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
{/if}

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

{#if $formData.specific}
  <Form.Field {form} name="serialNumber" class="flex flex-col">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Serial Number</Form.Label>
        <Input
          bind:value={$formData.serialNumber}
          {...props}
          placeholder="e.g., 1234"
        />
        <Form.Description>
          The manufacturer serial number (MSN).
        </Form.Description>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <DateField
    {form}
    name="firstFlight"
    label="First Flight"
    minValue="1900-01-01"
  />
{/if}
