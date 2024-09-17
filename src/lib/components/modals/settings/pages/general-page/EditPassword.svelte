<script lang="ts">
  import { Modal } from '$lib/components/ui/modal';
  import { Button } from '$lib/components/ui/button';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { editPasswordSchema } from '$lib/zod/user';
  import { zod } from 'sveltekit-superforms/adapters';
  import * as Form from '$lib/components/ui/form';
  import { PasswordInput } from '$lib/components/ui/input';
  import { toast } from 'svelte-sonner';
  import { postViaForm } from '$lib/utils';

  let open = false;

  const form = superForm(
    defaults<Infer<typeof editPasswordSchema>>(zod(editPasswordSchema)),
    {
      validators: zod(editPasswordSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            toast.success(form.message.text);
            postViaForm('/log-out', {});
            return;
          }
          toast.error(form.message.text);
        }
      },
    },
  );
  const { form: formData, enhance } = form;
</script>

<Button variant="outline" on:click={() => (open = true)}>Edit password</Button>

<Modal bind:open dialogOnly>
  <h1>Edit Password</h1>
  <form method="POST" action="/api/users/edit-password" use:enhance>
    <Form.Field {form} name="currentPassword">
      <Form.Control let:attrs>
        <Form.Label>Current Password</Form.Label>
        <PasswordInput bind:value={$formData.currentPassword} {...attrs} />
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <div class="flex justify-between gap-2">
      <Form.Field {form} name="newPassword">
        <Form.Control let:attrs>
          <Form.Label>New Password</Form.Label>
          <PasswordInput bind:value={$formData.newPassword} {...attrs} />
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="confirmPassword">
        <Form.Control let:attrs>
          <Form.Label>Confirm Password</Form.Label>
          <PasswordInput bind:value={$formData.confirmPassword} {...attrs} />
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    <Form.Button class="mt-1">Save</Form.Button>
  </form>
</Modal>
