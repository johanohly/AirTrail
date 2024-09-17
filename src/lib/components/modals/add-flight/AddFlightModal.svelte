<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { flightSchema } from '$lib/zod/flight';
  import { zod } from 'sveltekit-superforms/adapters';
  import { toast } from 'svelte-sonner';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import FlightInformation from './FlightInformation.svelte';
  import SeatInformation from './SeatInformation.svelte';
  import { page } from '$app/stores';

  let {
    open = $bindable(),
    invalidator,
  }: { open: boolean; invalidator: { onSuccess: () => void } } = $props();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
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
  const { form: formData, enhance } = form;

  $effect(() => {
    if ($formData.seats[0] && $formData.seats[0].userId === '<USER_ID>') {
      $formData.seats[0].userId = $page.data.user?.id ?? null;
    }
  });
</script>

<Modal
  bind:open
  dialogOnly
  closeOnOutsideClick={false}
  classes="max-h-full overflow-y-auto max-w-lg"
>
  <h2>Add Flight</h2>
  <form method="POST" action="/api/flight/save" class="grid gap-4" use:enhance>
    <AirportField field="from" {form} />
    <AirportField field="to" {form} />
    <DateTimeField field="departure" {form} />
    <DateTimeField field="arrival" {form} />
    <SeatInformation {form} />
    <FlightInformation {form} />
    <Form.Button>Add Flight</Form.Button>
  </form>
</Modal>
