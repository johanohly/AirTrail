<script lang="ts">
  import { User } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { defaults, type Infer, superForm } from 'sveltekit-superforms';
  import { zod4 as zod } from 'sveltekit-superforms/adapters';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { hasClientPermission } from '$lib/authorization/permissions';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import * as Select from '$lib/components/ui/select';
  import type { PublicUser } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { addUserSchema, adminEditUserSchema } from '$lib/zod/user';

  type Mode = 'add' | 'edit';

  let {
    open = $bindable(),
    mode = 'add',
    user = undefined,
    initialDisplayName = '',
    onSuccess,
  }: {
    open: boolean;
    mode?: Mode;
    user?: PublicUser;
    initialDisplayName?: string;
    onSuccess?: (username: string) => void;
  } = $props();

  const isEdit = $derived(mode === 'edit');
  const canUpdateProfile = $derived(
    !isEdit || hasClientPermission(page.data.authorization, 'users.update'),
  );
  const canAssignRole = $derived(
    hasClientPermission(page.data.authorization, 'users.roles.assign'),
  );
  const schema = $derived(isEdit ? adminEditUserSchema : addUserSchema);
  let roles = $state<Array<{ id: string; name: string; isDefault: boolean }>>(
    [],
  );

  const getInitialData = () => {
    if (isEdit && user) {
      return {
        username: user.username,
        displayName: user.displayName,
        roleId: user.roleId ?? '',
      };
    }
    return {
      username: '',
      password: '',
      displayName: initialDisplayName,
      roleId: roles.find((role) => role.isDefault)?.id ?? '',
    };
  };

  const form = superForm(
    defaults<Infer<typeof addUserSchema>>(zod(addUserSchema)),
    {
      dataType: 'json',
      validators: zod(schema),
      onSubmit() {
        if (mode === 'edit' && user) {
          // @ts-expect-error - id is only in adminEditUserSchema
          $formData.id = user.id;
        }
      },
      async onUpdate({ form: f }) {
        if (f.message) {
          if (f.message.type === 'success') {
            await invalidateAll();
            onSuccess?.($formData.username);
            open = false;
            return void toast.success(f.message.text);
          }
          toast.error(f.message.text);
        }
      },
    },
  );

  const { form: formData, enhance, submitting, tainted } = form;

  $effect(() => {
    if (open) {
      void (async () => {
        roles = canAssignRole ? await api.role.assignableOptions.query() : [];
        const data = getInitialData();
        form.reset({ data });
      })();
    }
  });
</script>

<Modal
  bind:open
  dismissal="form"
  dirty={form.isTainted($tainted)}
  busy={$submitting}
  onDiscard={() => form.reset()}
>
  <ModalBreadcrumbHeader
    section="Users"
    title={isEdit ? 'Edit user' : 'Add user'}
    icon={User}
  />
  <ModalBody>
    <form
      class="flex flex-col gap-2"
      method="POST"
      action={isEdit ? '/api/users/admin-edit' : '/api/users/add'}
      use:enhance
    >
      <Form.Field {form} name="username">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Username</Form.Label>
            <Input
              bind:value={$formData.username}
              class="read-only:cursor-default read-only:opacity-70"
              readonly={!canUpdateProfile}
              {...props}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      {#if !isEdit}
        <Form.Field {form} name="password">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Password</Form.Label>
              <Input
                type="password"
                bind:value={$formData.password}
                {...props}
              />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      {/if}
      <Form.Field {form} name="displayName">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Name</Form.Label>
            <Input
              bind:value={$formData.displayName}
              class="read-only:cursor-default read-only:opacity-70"
              readonly={!canUpdateProfile}
              {...props}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      {#if canAssignRole}
        <Form.Field {form} name="roleId" class="pt-1">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>Role</Form.Label>
              <Select.Root
                type="single"
                name={props.name}
                bind:value={$formData.roleId}
              >
                <Select.Trigger {...props}>
                  {roles.find((role) => role.id === $formData.roleId)?.name ??
                    'Select a role'}
                </Select.Trigger>
                <Select.Content>
                  {#each roles as role}
                    <Select.Item value={role.id} label={role.name} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      {:else}
        <input type="hidden" name="roleId" bind:value={$formData.roleId} />
        <div class="grid gap-2 pt-1">
          <Form.Label>Role</Form.Label>
          <Input value={user?.roleName ?? 'No role'} disabled />
        </div>
      {/if}
      <Form.Button disabled={$submitting} class="mt-1">
        {isEdit ? 'Save' : 'Add'}
      </Form.Button>
    </form>
  </ModalBody>
</Modal>
