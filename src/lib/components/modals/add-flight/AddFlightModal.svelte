<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import FlightInformation from './FlightInformation.svelte';
  import FlightNumber from './FlightNumber.svelte';
  import SeatInformation from './SeatInformation.svelte';

  import { page } from '$app/state';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import { flightSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
      validators: zod(flightSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.flight.list.utils.invalidate();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;

  $effect(() => {
    if ($formData.seats[0] && $formData.seats[0].userId === '<USER_ID>') {
      $formData.seats[0].userId = page.data.user?.id ?? null;
    }
  });
</script>

<Modal bind:open dialogOnly closeOnOutsideClick={false}>
  <h2>Add Flight</h2>
  <form
    method="POST"
    action="/api/flight/save/form"
    class="grid gap-4"
    use:enhance
  >
    <FlightNumber {form} />
    <AirportField field="from" {form} />
    <AirportField field="to" {form} />
    <DateTimeField field="departure" {form} />
    <DateTimeField field="arrival" {form} />
    <SeatInformation {form} />
    <FlightInformation {form} />
    <Form.Button>Add Flight</Form.Button>
  </form>
</Modal>
