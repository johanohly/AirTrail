<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AircraftFormFields from './AircraftFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import type { Aircraft } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { aircraftSchema } from '$lib/zod/aircraft';

  let {
    aircraft,
  }: {
    aircraft: Aircraft;
  } = $props();

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof aircraftSchema>>(aircraft, zod(aircraftSchema)),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(aircraftSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.aircraft.list.utils.invalidate();
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

<Button variant="outline" size="icon" onclick={() => (open = true)}>
  <SquarePen size={16} />
</Button>

<Modal bind:open closeOnOutsideClick={false} class="max-w-lg">
  <ModalBreadcrumbHeader
    section="Aircraft"
    title="Edit aircraft"
    icon={SquarePen}
  />
  <ModalBody>
    <form
      method="POST"
      action="/api/aircraft/save/form"
      use:enhance
      class="grid gap-4"
    >
      <AircraftFormFields {form} />
      <Form.Button>Save</Form.Button>
    </form>
  </ModalBody>
</Modal>
