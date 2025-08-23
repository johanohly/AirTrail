<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AircraftFormFields from './AircraftFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { aircraftSchema } from '$lib/zod/aircraft';
  import { trpc } from '$lib/trpc';

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof aircraftSchema>>(zod(aircraftSchema)),
    {
      dataType: 'json',
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

<Button
  variant="outline"
  onclick={() => (open = true)}
  class="font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
>
  <Plus size={16} class="shrink-0 mr-2" />
  Create
</Button>

<Modal bind:open dialogOnly>
  <h2 class="text-lg font-medium">Add Aircraft</h2>
  <form
    method="POST"
    action="/api/aircraft/save/form"
    class="grid gap-4"
    use:enhance
  >
    <AircraftFormFields {form} />
    <Form.Button>Create</Form.Button>
  </form>
</Modal>
