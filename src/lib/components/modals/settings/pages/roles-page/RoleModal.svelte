<script lang="ts">
  import { ShieldCheck } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    hasClientPermission,
    impliedPermission,
    type Permission,
    type PermissionGroup,
  } from '$lib/authorization/permissions';
  import {
    groupAccessItems,
    type AccessRow,
  } from '$lib/authorization/access-presentation';
  import { createAccessSelection } from '$lib/authorization/access-selection';
  import AccessMatrix from '$lib/components/access/AccessMatrix.svelte';
  import { Button } from '$lib/components/ui/button';
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

  type PermissionItem = PermissionGroup['permissions'][number];
  type PermissionRow = AccessRow<PermissionItem>;

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
    permissions = withReadForWrite(role?.permissions ?? []);
  });

  const presentedPermissionGroups = $derived(
    permissionGroups.map((group) => ({
      label: group.label,
      rows: groupAccessItems(group.permissions, (permission) => permission.key),
    })),
  );
  const availablePermissions = (action: PermissionRow['actions'][number]) =>
    action.items.filter((permission) =>
      hasClientPermission(page.data.authorization, permission.key),
    );
  const permissionIsImplied = (permission: PermissionItem) => {
    const broader = impliedPermission(permission.key);
    return broader !== null && permissions.includes(broader);
  };
  const permissionIsEffective = (permission: PermissionItem) =>
    permissions.includes(permission.key) || permissionIsImplied(permission);
  const selection = createAccessSelection<PermissionItem>({
    isEffective: permissionIsEffective,
    selectable: availablePermissions,
  });
  const actionInherited = (
    row: PermissionRow,
    action: PermissionRow['actions'][number],
  ) => {
    const available = selection.actionItems(action);
    return (
      (available.length > 0 && available.every(permissionIsImplied)) ||
      selection.readLockedByWrite(row, action)
    );
  };
  const actionTitle = (
    row: PermissionRow,
    action: PermissionRow['actions'][number],
  ) => {
    const details = action.items
      .map((permission) => permission.description)
      .join(' · ');
    if (selection.readLockedByWrite(row, action))
      return `Included by Write access. ${details}`;
    const available = selection.actionItems(action);
    return available.length > 0 && available.every(permissionIsImplied)
      ? `Included by All flights. ${details}`
      : details;
  };
  const withReadForWrite = (keys: readonly Permission[]) => {
    const result = new Set(keys);
    for (const group of presentedPermissionGroups) {
      for (const row of group.rows) {
        const write = selection.rowAction(row, 'write');
        const read = selection.rowAction(row, 'read');
        if (!write || !read) continue;
        if (!write.items.some((permission) => result.has(permission.key)))
          continue;
        for (const permission of selection.actionItems(read))
          result.add(permission.key);
      }
    }
    return [...result];
  };
  const toggleAction = (
    row: PermissionRow,
    action: PermissionRow['actions'][number],
  ) => {
    if (selection.readLockedByWrite(row, action)) return;
    const available = selection.actionItems(action);
    const checked = available.every(permissionIsEffective);
    const changed = new Set(permissions);
    for (const permission of available) {
      if (permissionIsImplied(permission)) continue;
      if (checked) {
        changed.delete(permission.key);
      } else {
        changed.add(permission.key);
        for (const candidate of permissions) {
          if (impliedPermission(candidate) === permission.key)
            changed.delete(candidate);
        }
      }
    }
    permissions =
      action.action === 'write' && !checked
        ? withReadForWrite([...changed])
        : [...changed];
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
        {#each presentedPermissionGroups as group}
          <section class="space-y-2">
            <h3 class="text-sm font-semibold">{group.label}</h3>
            <div class="divide-y rounded-md border">
              <AccessMatrix
                rows={group.rows}
                cellState={(row, action) => ({
                  checked: selection.actionChecked(action),
                  indeterminate: selection.actionIndeterminate(action),
                  inherited: actionInherited(row, action),
                  disabled:
                    selection.actionItems(action).length === 0 ||
                    actionInherited(row, action),
                  title: actionTitle(row, action),
                })}
                onToggle={toggleAction}
              />
            </div>
          </section>
        {/each}
      </div>

      <Button class="w-full" onclick={save} loading={saving}>Save role</Button>
    </div>
  </ModalBody>
</Modal>
