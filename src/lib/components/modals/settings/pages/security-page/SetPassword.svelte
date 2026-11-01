<script lang="ts">
  import { KeyRound } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { invalidateAll } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import * as Form from '$lib/components/ui/form';
  import { PasswordInput } from '$lib/components/ui/input';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import { setPasswordSchema } from '$lib/zod/user';

  let open = $state(false);

  const form = superForm(
    defaults<Infer<typeof setPasswordSchema>>(zod(setPasswordSchema)),
    {
      validators: zod(setPasswordSchema),
      invalidateAll: false,
      async onUpdated({ form }) {
        if (!form.message) return;
        if (form.message.type === 'success') {
          toast.success(form.message.text);
          await invalidateAll();
          open = false;
          return;
        }
        toast.error(form.message.text);
      },
    },
  );
  const { form: formData, enhance, submitting, tainted } = form;
</script>

<Button variant="outline" onclick={() => (open = true)}>Set password</Button>

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
>
  <ModalBreadcrumbHeader
    section="Security"
    title="Set password"
    icon={KeyRound}
  />
  <ModalBody>
    <form
      class="flex flex-col gap-2"
      method="POST"
      action="/api/users/set-password"
      use:enhance
    >
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
              <PasswordInput
                bind:value={$formData.confirmPassword}
                {...props}
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      </div>
      <Form.Button class="mt-1">Save</Form.Button>
    </form>
  </ModalBody>
</Modal>
