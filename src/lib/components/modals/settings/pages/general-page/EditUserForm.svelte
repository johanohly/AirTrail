<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { page } from '$app/state';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { editUserSchema } from '$lib/zod/user';

  const form = superForm(
    defaults<Infer<typeof editUserSchema>>(page.data.user, zod(editUserSchema)),
    {
      resetForm: false,
      validators: zod(editUserSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            toast.success(form.message.text);
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;
</script>

<form
  method="POST"
  action="/api/users/edit"
  use:enhance
  class="flex flex-col gap-2"
>
  <Form.Field {form} name="username">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Username</Form.Label>
        <Input bind:value={$formData.username} {...props} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="displayName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Display Name</Form.Label>
        <Input bind:value={$formData.displayName} {...props} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Button class="mt-1">Save</Form.Button>
</form>
