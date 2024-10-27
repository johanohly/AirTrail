<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';
  import { AircraftField, AirlineField } from '$lib/components/form-fields';
  import { Separator } from '$lib/components/ui/separator';
  import { FlightReasons } from '$lib/db/types';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<section>
  <h3 class="font-medium">Flight Information</h3>
  <Separator class="mt-2 mb-3" />
  <div class="grid gap-4">
    <div class="grid grid-cols-[2fr_1fr] gap-2">
      <AircraftField {form} />
      <Form.Field {form} name="aircraftReg" class="flex flex-col">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Registration</Form.Label>
            <Input bind:value={$formData.aircraftReg} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    <AirlineField {form} />
    <Form.Field {form} name="flightReason">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Flight Reason</Form.Label>
          <Select.Root
            type="single"
            value={$formData.flightReason ?? undefined}
            onValueChange={(value) => {
              // @ts-expect-error - value is a FlightReason
              $formData.flightReason = FlightReasons.includes(value)
                ? value
                : null;
            }}
          >
            <Select.Trigger {...props}>
              {$formData.flightReason
                ? toTitleCase($formData.flightReason)
                : 'Select flight reason'}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="leisure" label="Leisure" />
              <Select.Item value="business" label="Business" />
              <Select.Item value="crew" label="Crew" />
              <Select.Item value="other" label="Other" />
            </Select.Content>
          </Select.Root>
          <input
            type="hidden"
            value={$formData.flightReason}
            name={props.name}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="note">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Notes</Form.Label>
          <Textarea
            bind:value={$formData.note}
            class="resize-y h-20 min-h-10 max-h-32"
            {...props}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
</section>
