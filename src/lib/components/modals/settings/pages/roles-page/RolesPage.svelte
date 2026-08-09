<script lang="ts">
  import { Copy, Plus, SquarePen, Star, Trash2 } from '@o7/icon/lucide';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';
  import RoleModal, { type EditableRole } from './RoleModal.svelte';

  import type {
    Permission,
    PermissionGroup,
  } from '$lib/authorization/permissions';
  import { Confirm } from '$lib/components/helpers';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { api } from '$lib/trpc';
  import { getErrorText } from '$lib/utils/error';

  type Role = EditableRole & {
    id: string;
    userCount: number;
    isDefault: boolean;
    permissions: Permission[];
  };

  let roles = $state<Role[]>([]);
  let permissionGroups = $state<PermissionGroup[]>([]);
  let audits = $state<
    Array<{
      id: number;
      action: string;
      targetType: string;
      targetId: string;
      createdAt: Date;
      actorName: string | null;
    }>
  >([]);
  let loading = $state(true);
  let modalOpen = $state(false);
  let editingRole = $state<EditableRole | null>(null);

  const load = async () => {
    const [result, auditResult] = await Promise.all([
      api.role.list.query(),
      api.role.audit.query(),
    ]);
    roles = result.roles;
    permissionGroups = result.permissionGroups;
    audits = auditResult;
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
    <Button size="sm" onclick={() => openCreate()}>
      <Plus class="mr-1 size-4" />
      New role
    </Button>
  {/snippet}

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading roles…</p>
  {:else}
    <div class="divide-y rounded-md border">
      {#each roles as role}
        <div class="flex items-center gap-3 px-3 py-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="truncate font-medium">{role.name}</h4>
              {#if role.isDefault}<Badge variant="secondary">Default</Badge
                >{/if}
            </div>
            <p class="truncate text-sm text-muted-foreground">
              {role.description || 'No description'}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {role.userCount}
              {role.userCount === 1 ? 'user' : 'users'} ·
              {role.permissions.length} permissions
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Make default"
              aria-label={`Make ${role.name} the default role`}
              disabled={role.isDefault}
              onclick={() => setDefault(role)}
            >
              <Star class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Duplicate role"
              aria-label={`Duplicate ${role.name}`}
              onclick={() => openCreate(role)}
            >
              <Copy class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Edit role"
              aria-label={`Edit ${role.name}`}
              onclick={() => {
                editingRole = role;
                modalOpen = true;
              }}
            >
              <SquarePen class="size-4" />
            </Button>
            <Confirm
              title="Delete role"
              description="This cannot be undone. Roles in use must be reassigned first."
              onConfirm={() => deleteRole(role)}
            >
              {#snippet triggerContent({ props })}
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  title="Delete role"
                  aria-label={`Delete ${role.name}`}
                  disabled={role.isDefault || role.userCount > 0}
                >
                  <Trash2 class="size-4" />
                </Button>
              {/snippet}
            </Confirm>
          </div>
        </div>
      {/each}
    </div>

    {#if audits.length}
      <section class="space-y-2 pt-2">
        <h3 class="text-sm font-semibold">Recent authorization changes</h3>
        <div class="divide-y rounded-md border">
          {#each audits.slice(0, 10) as audit}
            <div class="flex items-start justify-between gap-4 px-3 py-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm">
                  {audit.action.replaceAll('_', ' ').replaceAll('.', ' ')}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {audit.actorName ?? 'System'} · {audit.targetType}
                </p>
              </div>
              <time
                class="shrink-0 text-xs tabular-nums text-muted-foreground"
                datetime={audit.createdAt.toISOString()}
              >
                {audit.createdAt.toLocaleDateString()}
              </time>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</PageHeader>
