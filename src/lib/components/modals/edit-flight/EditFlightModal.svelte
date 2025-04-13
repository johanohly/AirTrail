<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { AirportField, DateTimeField } from '$lib/components/form-fields';
  import FlightInformation from '$lib/components/modals/add-flight/FlightInformation.svelte';
  import FlightNumber from '$lib/components/modals/add-flight/FlightNumber.svelte';
  import SeatInformation from '$lib/components/modals/add-flight/SeatInformation.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Form from '$lib/components/ui/form';
  import { trpc } from '$lib/trpc';
  import type { FlightData } from '$lib/utils';
  import { formatAsTime } from '$lib/utils/datetime';
  import { flightSchema } from '$lib/zod/flight';

  let {
    flight,
    triggerDisabled,
  }: {
    flight: FlightData;
    triggerDisabled: boolean;
  } = $props();

  const schemaFlight = {
    ...(flight.raw as unknown as Omit<
      typeof flight.raw,
      'id' | 'userId' | 'date' | 'duration'
    >),
    departure: flight.departure
      ? flight.departure.toISOString()
      : flight.date.toISOString(),
    arrival: flight.arrival ? flight.arrival.toISOString() : null,
    departureTime: flight.departure ? formatAsTime(flight.departure) : null,
    arrivalTime: flight.arrival ? formatAsTime(flight.arrival) : null,
  };

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(schemaFlight, zod(flightSchema)),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(flightSchema),
      onSubmit() {
        $formData.id = flight.id;
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
  const { form: formData, enhance } = form;
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button
        variant="outline"
        size="icon"
        {...props}
        disabled={triggerDisabled}
      >
        <SquarePen size="20" />
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content
    preventScroll={false}
    interactOutsideBehavior="ignore"
    class="max-h-full overflow-y-auto max-w-lg"
  >
    <h2 class="text-lg font-medium">Edit Flight</h2>
    <form
      method="POST"
      action="/api/flight/save/form"
      use:enhance
      class="grid gap-4"
    >
      <FlightNumber {form} />
      <AirportField field="from" {form} />
      <AirportField field="to" {form} />
      <DateTimeField field="departure" {form} />
      <DateTimeField field="arrival" {form} />
      <SeatInformation {form} />
      <FlightInformation {form} />
      <Form.Button>Save</Form.Button>
    </form>
  </Dialog.Content>
</Dialog.Root>
