<script lang="ts">
  import { SquarePen } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirportFormFields from '$lib/components/modals/settings/pages/data-page/airport/AirportFormFields.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
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
      { ...airport, iata: airport.iata || '' },
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

<Dialog.Root bind:open>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" size="icon" {...props}>
        <SquarePen size="20" />
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content
    preventScroll={false}
    interactOutsideBehavior="ignore"
    class="max-h-full overflow-y-auto max-w-lg"
  >
    <h2>Edit Airport</h2>
    <form
      method="POST"
      action="/api/airport/save/form"
      use:enhance
      class="grid gap-4"
    >
      <AirportFormFields {form} />
      <Form.Button>Save</Form.Button>
    </form>
  </Dialog.Content>
</Dialog.Root>
