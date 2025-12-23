<script lang="ts">
  import { ChevronRight, SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { FlightForm } from '$lib/components/modals/flight-form';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal, ModalFooter, ModalHeader } from '$lib/components/ui/modal';
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

<Modal bind:open closeOnOutsideClick={false} class="max-w-screen-lg gap-0">
  <ModalHeader>
    <div class="flex min-w-0 max-w-full items-center gap-1">
      <div class="flex min-w-0 items-center gap-2 px-1.5">
        <span class="min-w-0 truncate text-sm font-semibold">Flights</span>
      </div>
      <ChevronRight size={14} class="text-muted-foreground shrink-0" />
      <div class="flex min-w-0 items-center gap-2 px-1">
        <div
          class="flex items-center justify-center rounded-full bg-muted px-0 size-5 shrink-0"
        >
          <SquarePen size={14} />
        </div>
        <h3 class="!mt-0 max-w-sm truncate text-sm font-medium">Edit flight</h3>
      </div>
    </div>
  </ModalHeader>
  <form method="POST" action="/api/flight/save/form" use:enhance>
    <FlightForm {form} />
    <ModalFooter>
      <Form.Button size="sm">Save</Form.Button>
    </ModalFooter>
  </form>
</Modal>
