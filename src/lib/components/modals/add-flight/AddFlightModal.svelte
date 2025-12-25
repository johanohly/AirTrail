<script lang="ts">
  import { Globe } from '@o7/icon';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/state';
  import * as Form from '$lib/components/ui/form';
  import {
    Modal,
    ModalBreadcrumbHeader,
    ModalFooter,
  } from '$lib/components/ui/modal';
  import { FlightForm } from '$lib/components/modals/flight-form';
  import { flightAddedState } from '$lib/state.svelte';
  import { trpc } from '$lib/trpc';
  import { flightSchema } from '$lib/zod/flight';

  let { open = $bindable() }: { open: boolean } = $props();

  const form = superForm(
    defaults<Infer<typeof flightSchema>>(zod(flightSchema)),
    {
      dataType: 'json',
      validators: zod(flightSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.flight.list.utils.invalidate();
            open = false;
            flightAddedState.added = true;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;

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
      <Form.Button size="sm">Add Flight</Form.Button>
    </ModalFooter>
  </form>
</Modal>
