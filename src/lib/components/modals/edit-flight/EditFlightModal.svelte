<script lang="ts">
  import type { FlightData } from '$lib/utils';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Form from '$lib/components/ui/form';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { flightSchema } from '$lib/zod/flight';
  import { buttonVariants } from '$lib/components/ui/button';
  import { SquarePen } from '@o7/icon/lucide';
  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import OptionalFlightInformation from '$lib/components/modals/add-flight/OptionalFlightInformation.svelte';
  import { toast } from 'svelte-sonner';
  import { trpc } from '$lib/trpc';

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: 'numeric',
  });

  let {
    flight,
  }: {
    flight: FlightData;
  } = $props();

  const schemaFlight = {
    ...(flight.raw as unknown as Omit<
      typeof flight.raw,
      'id' | 'userId' | 'date' | 'duration'
    >),
    departure: flight.departure?.toISOString() ?? flight.date.toISOString(),
    arrival: flight.arrival?.toISOString() ?? null,
    departureTime: flight.departure
      ? timeFormatter.format(flight.departure.toDate())
      : null,
    arrivalTime: flight.arrival
      ? timeFormatter.format(flight.arrival.toDate())
      : null,
  };

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(schemaFlight, zod(flightSchema)),
    {
      id: String(flight.id),
      validators: zod(flightSchema),
      onSubmit({ formData }) {
        formData.set('id', String(flight.id));
      },
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
  const { enhance } = form;
</script>

<Dialog.Root bind:open closeOnOutsideClick={false} preventScroll={false}>
  <Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
    <SquarePen size="20" />
  </Dialog.Trigger>
  <Dialog.Content classes="max-h-full overflow-y-auto max-w-lg">
    <h2>Edit Flight</h2>
    <form method="POST" action="?/save-flight" use:enhance class="grid gap-4">
      <AirportField field="from" {form} />
      <AirportField field="to" {form} />
      <DateTimeField field="departure" {form} />
      <DateTimeField field="arrival" {form} />
      <OptionalFlightInformation {form} />
      <Form.Button>Save</Form.Button>
    </form>
  </Dialog.Content>
</Dialog.Root>
