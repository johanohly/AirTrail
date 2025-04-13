<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { PasswordInput } from '$lib/components/ui/input';
  import { Modal } from '$lib/components/ui/modal';
  import { postViaForm } from '$lib/utils';
  import { editPasswordSchema } from '$lib/zod/user';

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

<Button variant="outline" onclick={() => (open = true)}>Edit password</Button>

<Modal bind:open dialogOnly>
  <h1 class="text-lg font-medium">Edit Password</h1>
  <form method="POST" action="/api/users/edit-password" use:enhance>
    <Form.Field {form} name="currentPassword">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Current Password</Form.Label>
          <PasswordInput bind:value={$formData.currentPassword} {...props} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <div class="flex justify-between gap-2">
      <Form.Field {form} name="newPassword">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>New Password</Form.Label>
            <PasswordInput bind:value={$formData.newPassword} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="confirmPassword">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Confirm Password</Form.Label>
            <PasswordInput bind:value={$formData.confirmPassword} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
    <Form.Button class="mt-1">Save</Form.Button>
  </form>
</Modal>
