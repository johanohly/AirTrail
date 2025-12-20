<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import AirlineFormFields from './AirlineFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { trpc } from '$lib/trpc';
  import { airlineSearchCache } from '$lib/utils/data/airlines';
  import { airlineSchema } from '$lib/zod/airline';

  let { open = $bindable(false), withoutTrigger } = $props();

  const form = superForm(
    defaults<Infer<typeof airlineSchema>>(zod(airlineSchema)),
    {
      dataType: 'json',
      validators: zod(airlineSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.airline.list.utils.invalidate();
            airlineSearchCache.clear();
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
  <h2 class="text-lg font-medium">Add Airline</h2>
  <form
    method="POST"
    action="/api/airline/save/form"
    class="grid gap-4"
    use:enhance
  >
    <AirlineFormFields {form} />
    <p class="text-sm text-muted-foreground">
      You can add an icon after creating the airline by editing it.
    </p>
    <Form.Button>Create</Form.Button>
  </form>
</Modal>
