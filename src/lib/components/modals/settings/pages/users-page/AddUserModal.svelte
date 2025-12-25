<script lang="ts">
  import { User, ShieldCheck } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';

  import { invalidateAll } from '$app/navigation';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { HelpTooltip } from '$lib/components/ui/tooltip/index.js';
  import { addUserSchema } from '$lib/zod/user';

  let {
    open = $bindable(),
  }: {
    open: boolean;
  } = $props();

  const form = superForm(
    defaults<Infer<typeof addUserSchema>>(zod(addUserSchema)),
    {
      validators: zod(addUserSchema),
      onUpdated({ form }) {
        if (form.message) {
          if (form.message.type === 'success') {
            invalidateAll();
            open = false;
            return void toast.success(form.message.text);
          }
          toast.error(form.message.text);
        }
      },
    },
  );

  const { form: formData, enhance, submitting } = form;
</script>

<Modal bind:open>
  <ModalBreadcrumbHeader section="Users" title="Add user" icon={User} />
  <ModalBody>
    <form method="POST" action="/api/users/add" use:enhance>
      <Form.Field {form} name="username">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Username</Form.Label>
            <Input bind:value={$formData.username} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="password">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Password</Form.Label>
            <Input type="password" bind:value={$formData.password} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="displayName">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Name</Form.Label>
            <Input bind:value={$formData.displayName} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="role" class="pt-1">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label class="flex gap-1">
              Role
              <HelpTooltip
                text="Admins can do everything except delete other admins or the owner."
              />
            </Form.Label>
            <RadioGroup.Root
              bind:value={$formData.role}
              class="flex flex-col md:flex-row"
            >
              <Label
                class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
              >
                <RadioGroup.Item value="user" class="sr-only" />
                <div
                  class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
                >
                  <div class="flex items-center justify-center gap-1">
                    <User />
                    <span class="text-2xl font-bold">User</span>
                  </div>
                </div>
              </Label>
              <Label
                class="w-full cursor-pointer [&:has([data-state=checked])>div]:border-primary"
              >
                <RadioGroup.Item value="admin" class="sr-only" />
                <div
                  class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
                >
                  <div class="flex items-center justify-center gap-1">
                    <ShieldCheck />
                    <span class="text-2xl font-bold">Admin</span>
                  </div>
                </div>
              </Label>
            </RadioGroup.Root>
            <input type="hidden" bind:value={$formData.role} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Button disabled={$submitting} class="mt-1">Add</Form.Button>
    </form>
  </ModalBody>
</Modal>
