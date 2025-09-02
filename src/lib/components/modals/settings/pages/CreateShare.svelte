<script lang="ts">
  import { Plus } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import ShareFormFields from './ShareFormFields.svelte';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { Modal } from '$lib/components/ui/modal';
  import { shareSchema } from '$lib/zod/share';
  import { trpc } from '$lib/trpc';
  import { generateRandomString } from '$lib/utils/string';

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof shareSchema>>(zod(shareSchema)),
    {
      dataType: 'json',
      validators: zod(shareSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            trpc.share.list.utils.invalidate();
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

<Button onclick={() => (open = true)} variant="outline">
  <Plus size={16} class="shrink-0 mr-2" />
  Create
</Button>

<Modal bind:open dialogOnly>
  <h2 class="text-lg font-medium">Create Share</h2>
  <form
    method="POST"
    action="/api/share/save/form"
    class="grid gap-4"
    use:enhance
  >
    <ShareFormFields {form} />
    <Form.Button>Create</Form.Button>
  </form>
</Modal>
