<script lang="ts">
  import { Globe } from '@o7/icon';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/state';
  import {
    FlightCustomFieldsModal,
    FlightForm,
    FlightTerminalGateModal,
    FlightTrackModal,
  } from '$lib/components/modals/flight-form';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { flightAddedState, openModalsState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { flightFormSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const customFieldDefinitions = trpc.customField.listDefinitions.query({
    entityType: 'flight',
  });
  const passengerCustomFieldDefinitions =
    trpc.customField.listDefinitions.query({
      entityType: 'flight_passenger',
    });
  let customFieldValues = $state<Record<number, unknown>>({});
  let customFieldsModal = $state<ReturnType<typeof FlightCustomFieldsModal>>();
  let flightForm = $state<ReturnType<typeof FlightForm>>();

  const toCustomFieldsPayload = (): Record<string, unknown> => {
    const defs = $customFieldDefinitions.data ?? [];
    const keyById = new Map(defs.map((d) => [d.id, d.key]));
    const payload: Record<string, unknown> = {};

    for (const [id, value] of Object.entries(customFieldValues)) {
      const key = keyById.get(Number(id));
      if (key) {
        payload[key] = value;
      }
    }

    return payload;
  };

  const form = superForm(
    defaults<Infer<typeof flightFormSchema>>(zod(flightFormSchema)),
    {
      dataType: 'json',
      validators: zod(flightFormSchema),
      onSubmit({ cancel }) {
        $formData.customFields = toCustomFieldsPayload();
        const flightFieldsValid = customFieldsModal?.validate() ?? true;
        const passengerFieldsValid =
          flightForm?.validatePassengerCustomFields() ?? true;
        if (!flightFieldsValid || !passengerFieldsValid) {
          cancel();
        }
      },
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.flight.list.utils.invalidate();
            trpc.flightTrack.list.utils.invalidate();
            open = false;
            customFieldValues = {};
            flightAddedState.added = true;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance, submitting } = form;

  $effect(() => {
    const userId = page.data.user?.id;
    if (
      userId &&
      $formData.passengers[0] &&
      $formData.passengers[0].userId === '<USER_ID>'
    ) {
      $formData.passengers[0].userId = userId;
    }
  });
</script>

<Modal bind:open closeOnOutsideClick={false} class="max-w-screen-lg">
  <ModalBreadcrumbHeader section="Flights" title="New flight" icon={Globe} />
  <form method="POST" action="/api/flight/save/form" use:enhance>
    <FlightForm
      bind:this={flightForm}
      {form}
      passengerCustomFieldDefinitions={$passengerCustomFieldDefinitions.data ??
        []}
    />
    <ModalFooter>
      <div class="flex w-full items-center justify-between">
        <div class="flex items-center gap-2">
          <FlightTerminalGateModal {form} />
          <FlightTrackModal {form} />
          <FlightCustomFieldsModal
            bind:this={customFieldsModal}
            definitions={$customFieldDefinitions.data ?? []}
            bind:values={customFieldValues}
            onOpenSettings={page.data.user?.role !== 'user'
              ? () => {
                  open = false;
                  // Wait for both popstates (custom fields modal + this modal)
                  // to settle before opening settings.
                  let remaining = 2;
                  const onPopstate = () => {
                    if (--remaining === 0) {
                      window.removeEventListener('popstate', onPopstate);
                      openModalsState.settingsTab = 'custom-fields';
                      openModalsState.settings = true;
                    }
                  };
                  window.addEventListener('popstate', onPopstate);
                }
              : undefined}
          />
        </div>
        <Form.Button size="sm" loading={$submitting}>Add flight</Form.Button>
      </div>
    </ModalFooter>
  </form>
</Modal>
