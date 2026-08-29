<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import {
    canCreateUserAccount,
    hasClientPermission,
  } from '$lib/authorization/permissions';
  import { UserAvatar } from '$lib/components/display';
  import { Confirm } from '$lib/components/helpers';
  import UserModal from '$lib/components/modals/settings/pages/users-page/UserModal.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import type { DirectoryUser, PublicUser } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { getPreferences, matchPreset, presets } from '$lib/utils/preferences';

  const presetSummary = (user: PublicUser): string => {
    const key = matchPreset(getPreferences(user));
    return key ? presets[key].label : 'Custom';
  };

  const users = $derived(page.data.users);

  const deleteUser = async (id: string) => {
    const success = await api.user.delete.mutate(id);
    if (!success) {
      return void toast.error('Failed to delete user.');
    }
    await invalidateAll();
    toast.success('User deleted.');
  };

  const canDeleteUser = (current_user: DirectoryUser) => {
    if (current_user.isOwner) return false;
    return (
      current_user.id === page.data.user?.id ||
      (current_user.canManage &&
        hasClientPermission(page.data.authorization, 'users.delete'))
    );
  };

  const canEditUser = (current_user: DirectoryUser) => {
    return (
      !current_user.isOwner &&
      current_user.canManage &&
      (hasClientPermission(page.data.authorization, 'users.update') ||
        hasClientPermission(page.data.authorization, 'users.roles.assign'))
    );
  };

  const canAddUser = $derived(canCreateUserAccount(page.data.authorization));

  let addUserModal = $state(false);
  let editUserModal = $state(false);
  let editingUser = $state<PublicUser | undefined>(undefined);
</script>

<UserModal bind:open={addUserModal} mode="add" />
<UserModal bind:open={editUserModal} mode="edit" user={editingUser} />

<PageHeader title="Users" subtitle="Manage who can access AirTrail.">
  {#snippet headerRight()}
    {#if canAddUser}
      <Button variant="default" onclick={() => (addUserModal = true)}>
        Add user
      </Button>
    {/if}
  {/snippet}

  {#if users.length === 0}
    <p>No users found.</p>
  {:else}
    <div use:autoAnimate class="space-y-2">
      {#each users as current_user}
        <Card level="2" class="flex items-center p-3">
          <div class="flex items-center flex-1 gap-4 h-full min-w-0">
            <UserAvatar username={current_user.username} size={36} />
            <div class="flex flex-col min-w-0 w-2/5">
              <h4 class="leading-4 truncate">{current_user.displayName}</h4>
              <p class="text-sm text-muted-foreground truncate">
                {current_user.isOwner
                  ? 'Owner'
                  : (current_user.roleName ?? 'No role')}
                {#if current_user.roleAssignmentSource === 'oauth'}
                  · OAuth
                {/if}
              </p>
            </div>
            <div class="flex flex-1 flex-col min-w-0">
              <p class="text-muted-foreground truncate">
                {current_user.username}
              </p>
              <p class="text-sm text-muted-foreground truncate">
                {presetSummary(current_user)}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!canEditUser(current_user)}
              onclick={() => {
                editingUser = current_user;
                editUserModal = true;
              }}
            >
              <SquarePen size="20" />
            </Button>
            <Confirm
              onConfirm={async () => deleteUser(current_user.id)}
              title="Remove User"
              description="Are you sure you want to remove this user?"
            >
              {#snippet triggerContent({ props })}
                <Button
                  variant="outline"
                  size="icon"
                  {...props}
                  disabled={!canDeleteUser(current_user)}
                >
                  <X size="24" />
                </Button>
              {/snippet}
            </Confirm>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</PageHeader>
