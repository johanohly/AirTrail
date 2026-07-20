<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import { z } from 'zod';

  import { AircraftField, AirlineField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Input, Textarea } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import type { flightSchema } from '$lib/zod/flight';

  let {
    form,
  }: {
    form: SuperForm<z.infer<typeof flightSchema>>;
  } = $props();
  const { form: formData } = form;
</script>

<section>
  <Separator class="mt-2 mb-3 max-md:hidden" />
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
