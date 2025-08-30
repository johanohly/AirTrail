<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AircraftFormFields from './AircraftFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import { aircraftSchema } from '$lib/zod/aircraft';
  import { aircraftSearchCache } from '$lib/utils/data/aircraft';

  let { open = $bindable(false), withoutTrigger } = $props();

  const form = superForm(
    defaults<Infer<typeof aircraftSchema>>(zod(aircraftSchema)),
    {
      dataType: 'json',
      validators: zod(aircraftSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.aircraft.list.utils.invalidate();
            aircraftSearchCache.clear();
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

{#if !withoutTrigger}
  <Button variant="outline" onclick={() => (open = true)}>
    <Plus size={16} class="shrink-0 mr-2" />
    Create
  </Button>
{/if}

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
