<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { Copy, SquarePen, Star, Trash2 } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';
  import RoleModal, { type EditableRole } from './RoleModal.svelte';

  import { page } from '$app/state';
  import type {
    Permission,
    PermissionGroup,
  } from '$lib/authorization/permissions';
  import { canSetDefaultRole } from '$lib/authorization/permissions';
  import { Confirm } from '$lib/components/helpers';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { TextTooltip } from '$lib/components/ui/tooltip';
  import { api } from '$lib/trpc';
  import { getErrorText } from '$lib/utils/error';

  type Role = EditableRole & {
    id: string;
    userCount: number;
    oauthMappingCount: number;
    isDefault: boolean;
    permissions: Permission[];
  };

  let roles = $state<Role[]>([]);
  let permissionGroups = $state<PermissionGroup[]>([]);
  let loading = $state(true);
  let modalOpen = $state(false);
  let editingRole = $state<EditableRole | null>(null);
  const canSetDefault = $derived(canSetDefaultRole(page.data.authorization));

  const load = async () => {
    const result = await api.role.list.query();
    roles = result.roles;
    permissionGroups = result.permissionGroups;
    loading = false;
  };

  onMount(load);

  const openCreate = (source?: Role) => {
    editingRole = source
      ? {
          name: `${source.name} copy`,
          description: source.description,
          permissions: [...source.permissions],
        }
      : null;
    modalOpen = true;
  };

  const setDefault = async (role: Role) => {
    try {
      await api.role.setDefault.mutate(role.id);
      await load();
      toast.success(`${role.name} is now the default role.`);
    } catch (error) {
      toast.error(getErrorText(error) || 'Could not change the default role.');
    }
  };

  const deleteRole = async (role: Role) => {
    try {
      await api.role.delete.mutate(role.id);
      await load();
      toast.success('Role deleted.');
    } catch (error) {
      toast.error(getErrorText(error) || 'Could not delete the role.');
    }
  };

  const deleteTooltip = (role: Role) => {
    if (role.isDefault) return 'The default role cannot be deleted';
    if (role.userCount > 0)
      return 'Reassign its users before deleting this role';
    if (role.oauthMappingCount > 0)
      return 'Remove this role from OAuth mappings before deleting it';
    return 'Delete role';
  };

  const defaultTooltip = (role: Role) => {
    if (role.isDefault) return 'Default role';
    if (!canSetDefault)
      return 'Requires role assignment and OAuth management permissions';
    return 'Make default';
  };
</script>

<RoleModal
  bind:open={modalOpen}
  role={editingRole}
  {permissionGroups}
  onSaved={load}
/>

<PageHeader
  title="Roles"
  subtitle="Define what users can access. User and Administrator are editable defaults, just like every other role."
>
  {#snippet headerRight()}
    <Button onclick={() => openCreate()}>New role</Button>
  {/snippet}

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading roles…</p>
  {:else}
    <div use:autoAnimate class="space-y-2">
      {#each roles as role}
        <Card level="2" class="flex items-center p-3">
          <div class="flex items-center flex-1 gap-4 h-full min-w-0">
            <div class="flex flex-col min-w-0 w-2/5">
              <h4 class="truncate leading-5">{role.name}</h4>
              <p
                class="truncate text-sm text-muted-foreground"
                title={role.description || 'No description'}
              >
                {role.description || 'No description'}
              </p>
            </div>
            <div class="flex flex-1 flex-col min-w-0">
              <p class="truncate text-sm text-muted-foreground">
                {role.userCount}
                {role.userCount === 1 ? 'user' : 'users'}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {role.permissions.length}
                {role.permissions.length === 1 ? 'permission' : 'permissions'}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <TextTooltip
              content={defaultTooltip(role)}
              rootProps={{ delayDuration: 0 }}
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={role.isDefault
                  ? `${role.name} is the default role`
                  : `Make ${role.name} the default role`}
                aria-pressed={role.isDefault}
                disabled={role.isDefault || !canSetDefault}
                onclick={() => setDefault(role)}
              >
                {#if role.isDefault}
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-blue-500"
                    style="width: 20px; height: 20px"
                    aria-hidden="true"
                  >
                    <path
                      d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                    />
                  </svg>
                {:else}
                  <Star size="20" />
                {/if}
              </Button>
            </TextTooltip>
            <TextTooltip
              content="Duplicate role"
              rootProps={{ delayDuration: 0 }}
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={`Duplicate ${role.name}`}
                onclick={() => openCreate(role)}
              >
                <Copy size="20" />
              </Button>
            </TextTooltip>
            <TextTooltip content="Edit role" rootProps={{ delayDuration: 0 }}>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Edit ${role.name}`}
                onclick={() => {
                  editingRole = role;
                  modalOpen = true;
                }}
              >
                <SquarePen size="20" />
              </Button>
            </TextTooltip>
            <TextTooltip
              content={deleteTooltip(role)}
              rootProps={{ delayDuration: 0 }}
            >
              <Confirm
                title="Delete role"
                description="This cannot be undone. Roles assigned to users or OAuth mappings must be removed first."
                onConfirm={() => deleteRole(role)}
              >
                {#snippet triggerContent({ props })}
                  <Button
                    {...props}
                    variant="outline"
                    size="icon"
                    aria-label={`Delete ${role.name}`}
                    disabled={role.isDefault ||
                      role.userCount > 0 ||
                      role.oauthMappingCount > 0}
                  >
                    <Trash2 size="20" />
                  </Button>
                {/snippet}
              </Confirm>
            </TextTooltip>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</PageHeader>
