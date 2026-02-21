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
  } from '$lib/components/modals/flight-form';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { flightAddedState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { flightSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const customFieldDefinitions = trpc.customField.listDefinitions.query({
    entityType: 'flight',
  });
  let customFieldValues = $state<Record<number, unknown>>({});
  let customFieldsModal = $state<ReturnType<typeof FlightCustomFieldsModal>>();

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
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
      validators: zod(flightSchema),
      onSubmit({ cancel }) {
        $formData.customFields = toCustomFieldsPayload();
        if (!customFieldsModal?.validate()) {
          cancel();
        }
      },
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
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
        <div class="flex items-center gap-2">
          <FlightTerminalGateModal {form} />
          <FlightCustomFieldsModal
            bind:this={customFieldsModal}
            definitions={$customFieldDefinitions.data ?? []}
            bind:values={customFieldValues}
          />
        </div>
        <Form.Button size="sm" loading={$submitting}>Add Flight</Form.Button>
      </div>
    </ModalFooter>
  </form>
</Modal>
