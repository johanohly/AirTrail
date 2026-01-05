<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { SquarePen, X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { PageHeader } from '../index';

  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { Confirm } from '$lib/components/helpers';
  import UserModal from '$lib/components/modals/settings/pages/users-page/UserModal.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import type { User } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { toTitleCase } from '$lib/utils';

  const users = $derived(page.data.users);

  const deleteUser = async (id: string) => {
    const success = await api.user.delete.mutate(id);
    if (!success) {
      return void toast.error('Failed to delete user.');
    }
    await invalidateAll();
    toast.success('User deleted.');
  };

  const canDeleteUser = (current_user: User) => {
    if (current_user.role === 'owner') {
      return false;
    }
    if (current_user.role === 'admin' && page.data.user?.role === 'admin') {
      return false;
    }
    return true;
  };

  const canEditUser = (current_user: User) => {
    if (current_user.role === 'owner') {
      return false;
    }
    if (current_user.role === 'admin' && page.data.user?.role === 'admin') {
      return false;
    }
    return true;
  };

  let addUserModal = $state(false);
  let editUserModal = $state(false);
  let editingUser = $state<User | undefined>(undefined);
</script>

<UserModal bind:open={addUserModal} mode="add" />
<UserModal bind:open={editUserModal} mode="edit" user={editingUser} />

<PageHeader title="Users" subtitle="Manage who can access AirTrail.">
  {#snippet headerRight()}
    <Button variant="default" onclick={() => (addUserModal = true)}>
      Add User
    </Button>
  {/snippet}

  {#if users.length === 0}
    <p>No users found.</p>
  {:else}
    <div use:autoAnimate class="space-y-2">
      {#each users as current_user}
        <Card level="2" class="flex items-center p-3">
          <div class="flex items-center flex-1 gap-4 h-full min-w-0">
            <div class="flex flex-col min-w-0 w-2/5">
              <h4 class="leading-4 truncate">{current_user.displayName}</h4>
              <p class="text-sm text-muted-foreground truncate">
                {toTitleCase(current_user.role)}
              </p>
            </div>
            <div class="flex flex-1 flex-col min-w-0">
              <p class="text-muted-foreground truncate">
                {current_user.username}
              </p>
              <p class="text-sm text-muted-foreground truncate">
                {toTitleCase(current_user.unit)}
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
