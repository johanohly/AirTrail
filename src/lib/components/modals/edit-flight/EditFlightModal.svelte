<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { FlightForm } from '$lib/components/modals/flight-form';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import type { FlightData } from '$lib/utils';
  import { formatAsTime, isUsingAmPm } from '$lib/utils/datetime';
  import { flightSchema } from '$lib/zod/flight';

  let {
    flight,
    triggerDisabled = false,
    open = $bindable(false),
    showTrigger = true,
  }: {
    flight: FlightData;
    triggerDisabled?: boolean;
    open?: boolean;
    showTrigger?: boolean;
  } = $props();

  // If their language uses 12-hour time format, we display the time in *a* 12-hour format
  // (not necessarily the user's locale, because our time validator doesn't support all languages).
  const displayLocale = isUsingAmPm() ? 'en-US' : 'fr-FR';
  const schemaFlight = {
    ...(flight.raw as unknown as Omit<
      typeof flight.raw,
      'id' | 'userId' | 'date' | 'duration'
    >),
    departure: flight.departure
      ? flight.departure.toISOString()
      : flight.raw.date
        ? new Date(flight.raw.date + 'T00:00:00Z').toISOString()
        : null,
    arrival: flight.arrival ? flight.arrival.toISOString() : null,
    departureTime: flight.departure
      ? formatAsTime(flight.departure, displayLocale)
      : null,
    arrivalTime: flight.arrival
      ? formatAsTime(flight.arrival, displayLocale)
      : null,
  };

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(schemaFlight, zod(flightSchema)),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(flightSchema),
      onSubmit() {
        $formData.id = flight.id;
      },
      onUpdate({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.flight.list.utils.invalidate();
            toast.success(form.message.text);
            open = false;
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;
</script>

{#if showTrigger}
  <Button
    variant="outline"
    size="icon"
    onclick={() => (open = true)}
    disabled={triggerDisabled}
  >
    <SquarePen size={16} />
  </Button>
{/if}

<Modal bind:open closeOnOutsideClick={false} class="max-w-screen-lg">
  <ModalBreadcrumbHeader
    section="Flights"
    title="Edit flight"
    icon={SquarePen}
  />
  <form method="POST" action="/api/flight/save/form" use:enhance>
    <FlightForm {form} />
    <ModalFooter>
      <Form.Button size="sm">Save</Form.Button>
    </ModalFooter>
  </form>
</Modal>
