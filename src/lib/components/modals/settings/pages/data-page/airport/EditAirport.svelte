<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirportFormFields from '$lib/components/modals/settings/pages/data-page/airport/AirportFormFields.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Form from '$lib/components/ui/form';
  import type { Airport } from '$lib/db/types';
  import { trpc } from '$lib/trpc';
  import { airportSchema } from '$lib/zod/airport';

  let {
    airport,
  }: {
    airport: Airport;
  } = $props();

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof airportSchema>>(
      {
        ...airport,
        iata: airport.iata || '',
        municipality: airport.municipality || '',
      },
      zod(airportSchema),
    ),
    {
      dataType: 'json',
      id: Math.random().toString(36).substring(7),
      validators: zod(airportSchema),
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

<Button variant="outline" size="icon" onclick={() => (open = true)}>
  <SquarePen size="20" />
</Button>

<Modal bind:open closeOnOutsideClick={false} class="max-w-lg">
  <ModalBreadcrumbHeader
    section="Airports"
    title="Edit airport"
    icon={SquarePen}
  />
  <ModalBody>
    <form
      method="POST"
      action="/api/airport/save/form"
      use:enhance
      class="grid gap-4"
    >
      <AirportFormFields {form} />
      <Form.Button>Save</Form.Button>
    </form>
  </ModalBody>
</Modal>
