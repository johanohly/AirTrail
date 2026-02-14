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
  import { decomposeToLocal, isUsingAmPm } from '$lib/utils/datetime';
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

  const fromTz = flight.from?.tz ?? null;
  const toTz = flight.to?.tz ?? null;

  const dep = decomposeToLocal(flight.raw.departure, fromTz, displayLocale);
  const arr = decomposeToLocal(flight.raw.arrival, toTz, displayLocale);
  const depSched = decomposeToLocal(
    flight.raw.departureScheduled,
    fromTz,
    displayLocale,
  );
  const arrSched = decomposeToLocal(
    flight.raw.arrivalScheduled,
    toTz,
    displayLocale,
  );
  const takeoffSched = decomposeToLocal(
    flight.raw.takeoffScheduled,
    fromTz,
    displayLocale,
  );
  const takeoffAct = decomposeToLocal(
    flight.raw.takeoffActual,
    fromTz,
    displayLocale,
  );
  const landingSched = decomposeToLocal(
    flight.raw.landingScheduled,
    toTz,
    displayLocale,
  );
  const landingAct = decomposeToLocal(
    flight.raw.landingActual,
    toTz,
    displayLocale,
  );

  const schemaFlight = {
    ...(flight.raw as unknown as Omit<
      typeof flight.raw,
      'id' | 'userId' | 'date' | 'duration'
    >),
    departure:
      dep.date ??
      (flight.raw.date
        ? new Date(flight.raw.date + 'T00:00:00Z').toISOString()
        : null),
    arrival: arr.date,
    departureScheduled: depSched.date,
    arrivalScheduled: arrSched.date,
    takeoffScheduled: takeoffSched.date,
    takeoffActual: takeoffAct.date,
    landingScheduled: landingSched.date,
    landingActual: landingAct.date,
    departureTime: dep.time,
    arrivalTime: arr.time,
    departureScheduledTime: depSched.time,
    arrivalScheduledTime: arrSched.time,
    takeoffScheduledTime: takeoffSched.time,
    takeoffActualTime: takeoffAct.time,
    landingScheduledTime: landingSched.time,
    landingActualTime: landingAct.time,
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
