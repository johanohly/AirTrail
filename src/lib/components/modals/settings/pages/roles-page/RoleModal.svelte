<script lang="ts">
  import { ShieldCheck } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    hasClientPermission,
    type Permission,
    type PermissionGroup,
  } from '$lib/authorization/permissions';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Modal,
    ModalBody,
    ModalBreadcrumbHeader,
  } from '$lib/components/ui/modal';
  import { api } from '$lib/trpc';
  import { getErrorText } from '$lib/utils/error';
  import { openModalsState } from '$lib/state.svelte';
  import {
    ROLE_DESCRIPTION_MAX_LENGTH,
    ROLE_NAME_MAX_LENGTH,
  } from '$lib/zod/role';

  export type EditableRole = {
    id?: string;
    name: string;
    description: string | null;
    permissions: Permission[];
  };

  let {
    open = $bindable(),
    role,
    permissionGroups,
    onSaved,
  }: {
    open: boolean;
    role: EditableRole | null;
    permissionGroups: PermissionGroup[];
    onSaved: () => Promise<void>;
  } = $props();

  let name = $state('');
  let description = $state('');
  let permissions = $state<Permission[]>([]);
  let saving = $state(false);

  $effect(() => {
    if (!open) return;
    name = role?.name ?? '';
    description = role?.description ?? '';
    permissions = [...(role?.permissions ?? [])];
  });

  const togglePermission = (permission: Permission, checked: boolean) => {
    permissions = checked
      ? [...new Set([...permissions, permission])]
      : permissions.filter((candidate) => candidate !== permission);
  };

  const save = async () => {
    if (!name.trim()) return void toast.error('Enter a role name.');
    saving = true;
    try {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      };
      if (role?.id) {
        await api.role.update.mutate({ id: role.id, ...input });
      } else {
        await api.role.create.mutate(input);
      }
      open = false;
      toast.success(role?.id ? 'Role updated.' : 'Role created.');
    } catch (error) {
      toast.error(getErrorText(error) || 'Could not save the role.');
      saving = false;
      return;
    }

    try {
      await invalidateAll();
      if (
        hasClientPermission(page.data.authorization, 'roles.manage') ||
        hasClientPermission(page.data.authorization, 'users.roles.assign')
      ) {
        await onSaved();
      } else {
        openModalsState.settingsTab = 'general';
      }
    } catch {
      toast.error('Role saved, but the page could not be refreshed.');
    } finally {
      saving = false;
    }
  };
</script>

<Modal bind:open class="max-w-2xl">
  <ModalBreadcrumbHeader
    section="Roles"
    title={role?.id ? 'Edit role' : 'Create role'}
    icon={ShieldCheck}
  />
  <ModalBody>
    <div class="space-y-5">
      <div class="grid gap-2">
        <Label for="role-name">Name</Label>
        <Input
          id="role-name"
          bind:value={name}
          maxlength={ROLE_NAME_MAX_LENGTH}
        />
      </div>
      <div class="grid gap-2">
        <Label for="role-description">Description</Label>
        <Input
          id="role-description"
          bind:value={description}
          maxlength={ROLE_DESCRIPTION_MAX_LENGTH}
          placeholder="What people with this role can do"
        />
      </div>

      <div class="space-y-5">
        {#each permissionGroups as group}
          <section class="space-y-2">
            <h3 class="text-sm font-semibold">{group.label}</h3>
            <div class="divide-y rounded-md border">
              {#each group.permissions as permission}
                {@const available = hasClientPermission(
                  page.data.authorization,
                  permission.key,
                )}
                <label
                  class="flex items-start gap-3 px-3 py-2.5"
                  class:cursor-pointer={available}
                  class:opacity-55={!available}
                >
                  <Checkbox
                    bind:checked={
                      () => permissions.includes(permission.key),
                      (checked) => togglePermission(permission.key, checked)
                    }
                    disabled={!available}
                    class="mt-0.5"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">
                      {permission.label}
                    </span>
                    <span
                      class="block text-xs leading-relaxed text-muted-foreground"
                    >
                      {permission.description}
                    </span>
                  </span>
                </label>
              {/each}
            </div>
          </section>
        {/each}
      </div>

      <Button class="w-full" onclick={save} loading={saving}>Save role</Button>
    </div>
  </ModalBody>
</Modal>
