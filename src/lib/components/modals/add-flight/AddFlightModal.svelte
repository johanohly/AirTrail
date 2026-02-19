<script lang="ts">
  import { Globe } from '@o7/icon';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/state';
  import {
    FlightCustomFieldsModal,
    FlightForm,
  } from '$lib/components/modals/flight-form';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { flightAddedState } from '$lib/state.svelte';
  import { api, trpc } from '$lib/trpc';
  import { getErrorText } from '$lib/utils';
  import { flightSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const customFieldDefinitions = trpc.customField.listDefinitions.query({
    entityType: 'flight',
  });
  let customFieldValues = $state<Record<number, unknown>>({});
  let customFieldsModal = $state<ReturnType<typeof FlightCustomFieldsModal>>();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
      validators: zod(flightSchema),
      onSubmit({ cancel }) {
        if (!customFieldsModal?.validate()) {
          cancel();
        }
      },
      async onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            const flightId = form.message.id;

            if (flightId && Object.keys(customFieldValues).length) {
              try {
                await api.customField.setEntityValues.mutate({
                  entityType: 'flight',
                  entityId: String(flightId),
                  values: Object.entries(customFieldValues)
                    .map(([fieldId, value]) => ({
                      fieldId: Number(fieldId),
                      value: value ?? null,
                    }))
                    .filter((item) => Number.isFinite(item.fieldId)),
                });
              } catch (e) {
                console.error(e);
                const message = getErrorText(e);
                toast.error(
                  message
                    ? `Flight saved, but failed to save custom fields: ${message}`
                    : 'Flight saved, but failed to save custom fields',
                );
              }
            }

            trpc.flight.list.utils.invalidate();
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
    if ($formData.seats[0] && $formData.seats[0].userId === '<USER_ID>') {
      $formData.seats[0].userId = page.data.user?.id ?? null;
    }
  });
</script>

<Modal bind:open closeOnOutsideClick={false} class="max-w-screen-lg">
  <ModalBreadcrumbHeader section="Flights" title="New flight" icon={Globe} />
  <form method="POST" action="/api/flight/save/form" use:enhance>
    <FlightForm {form} />
    <ModalFooter>
      <div class="flex w-full items-center justify-between">
        <FlightCustomFieldsModal
          bind:this={customFieldsModal}
          definitions={$customFieldDefinitions.data ?? []}
          bind:values={customFieldValues}
        />
        <Form.Button size="sm" loading={$submitting}>Add Flight</Form.Button>
      </div>
    </ModalFooter>
  </form>
</Modal>
