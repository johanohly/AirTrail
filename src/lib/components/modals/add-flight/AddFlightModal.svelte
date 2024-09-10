<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { flightSchema } from '$lib/zod/flight';
  import { zod } from 'sveltekit-superforms/adapters';
  import { toast } from 'svelte-sonner';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import OptionalFlightInformation from './OptionalFlightInformation.svelte';

  let {
    open = $bindable(),
    invalidator,
  }: { open: boolean; invalidator: { onSuccess: () => void } } = $props();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      validators: zod(flightSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            invalidator.onSuccess();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { enhance } = form;
</script>

<Modal bind:open dialogOnly closeOnOutsideClick={false}>
  <h1>Add Flight</h1>
  <form method="POST" action="?/add-flight" class="grid gap-4" use:enhance>
    <AirportField field="from" {form} />
    <AirportField field="to" {form} />
    <DateTimeField field="departure" {form} />
    <DateTimeField field="arrival" {form} />
    <OptionalFlightInformation {form} />
    <Form.Button>Add Flight</Form.Button>
  </form>
</Modal>
