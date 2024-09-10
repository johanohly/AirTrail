<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';
  import { Input } from '$lib/components/ui/input';
  import { toTitleCase } from '$lib/utils';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<Accordion.Item value="seat">
  <Accordion.Trigger>Seat Information</Accordion.Trigger>
  <Accordion.Content>
    <div class="grid grid-cols-[1fr_1fr_1fr] gap-2">
      <Form.Field {form} name="seat">
        <Form.Control let:attrs>
          <Form.Label>Seat</Form.Label>
          <Select.Root
            selected={{
              label: $formData.seat ? toTitleCase($formData.seat) : undefined,
              value: $formData.seat,
            }}
            onSelectedChange={(value) => {
              if (value) {
                $formData.seat = value.value;
              }
            }}
          >
            <Select.Trigger {...attrs}>
              <Select.Value placeholder="Select seat..." />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="window" label="Window" />
              <Select.Item value="middle" label="Middle" />
              <Select.Item value="aisle" label="Aisle" />
              <Select.Item value="other" label="Other" />
            </Select.Content>
          </Select.Root>
          <input type="hidden" bind:value={$formData.seat} name={attrs.name} />
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="seatNumber">
        <Form.Control let:attrs>
          <Form.Label>Seat Number</Form.Label>
          <Input bind:value={$formData.seatNumber} {...attrs} />
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="seatClass">
        <Form.Control let:attrs>
          <Form.Label>Seat Class</Form.Label>
          <Select.Root
            selected={{
              label: $formData.seatClass
                ? toTitleCase($formData.seatClass)
                : undefined,
              value: $formData.seatClass,
            }}
            onSelectedChange={(value) => {
              if (value) {
                $formData.seatClass = value.value;
              }
            }}
          >
            <Select.Trigger {...attrs}>
              <Select.Value placeholder="Select class..." />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="economy" label="Economy" />
              <Select.Item value="economy+" label="Economy+" />
              <Select.Item value="business" label="Business" />
              <Select.Item value="first" label="First" />
              <Select.Item value="private" label="Private" />
            </Select.Content>
          </Select.Root>
          <input
            type="hidden"
            bind:value={$formData.seatClass}
            name={attrs.name}
          />
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  </Accordion.Content>
</Accordion.Item>
