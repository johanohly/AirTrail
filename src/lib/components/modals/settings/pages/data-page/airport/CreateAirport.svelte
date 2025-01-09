<script lang="ts">
  import { toast } from 'svelte-sonner';
  import SuperDebug, {
    defaults,
    type Infer,
    superForm,
  } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirportFormFields from './AirportFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import type { Airport } from '$lib/db/types';
  import { airportSchema } from '$lib/zod/airport';

  const {
    onAirportCreate,
  }: {
    onAirportCreate: (airport: Airport) => Promise<void>;
  } = $props();

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof airportSchema>>(zod(airportSchema)),
    {
      dataType: 'json',
      validators: zod(airportSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            open = false;
            toast.success(form.message.text);
            onAirportCreate({ ...form.data, custom: true });
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: data, enhance } = form;
</script>

<Button variant="outline" onclick={() => (open = true)}>Create</Button>

<Modal bind:open dialogOnly>
  <h2>Add Airport</h2>
  <SuperDebug data={$data} />
  <form
    method="POST"
    action="/api/airport/save/form"
    class="grid gap-4"
    use:enhance
  >
    <AirportFormFields {form} />
    <Form.Button>Create</Form.Button>
  </form>
</Modal>
