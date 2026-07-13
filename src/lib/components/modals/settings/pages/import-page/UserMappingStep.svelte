<script lang="ts">
  import { Users } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { api } from '$lib/trpc';

  let {
    exportedUsers = [],
    userMapping = {},
    restoreMode = false,
    busy = false,
    onback,
    onnext,
  }: {
    exportedUsers?: {
      id: string;
      username: string;
      displayName: string;
      mappedUserId: string | null;
    }[];
    userMapping?: Record<string, string>;
    restoreMode?: boolean;
    busy?: boolean;
    onback?: () => void;
    onnext?: (userMapping: Record<string, string>) => void;
  } = $props();

  const usersPromise = api.user.list.query();

  let localMapping = $state<Record<string, string>>({ ...userMapping });

  const mappedCount = $derived(Object.keys(localMapping).length);
  const canContinue = $derived(
    restoreMode ||
      Object.values(localMapping).filter(
        (mappedUserId) => mappedUserId === page.data.user?.id,
      ).length === 1,
  );

  type MappableUser = {
    id: string;
    username: string;
    displayName: string;
  };

  const selectableUsers = (users: MappableUser[]) =>
    restoreMode
      ? users
      : users.filter((user) => user.id === page.data.user?.id);

  const setUserMapping = (exportedUserId: string, mappedUserId: string) => {
    if (mappedUserId) {
      if (!restoreMode) {
        for (const id of Object.keys(localMapping)) {
          delete localMapping[id];
        }
      }
      localMapping[exportedUserId] = mappedUserId;
    } else {
      delete localMapping[exportedUserId];
    }
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">
    {restoreMode ? 'Map exported users' : 'Choose your exported account'}
  </h3>

  <Card class="p-4 space-y-4">
    <div class="flex items-start gap-3">
      <Users class="text-muted-foreground mt-0.5 shrink-0" size={20} />
      <div>
        <p class="text-sm">
          {restoreMode
            ? 'Review and adjust user mapping before import.'
            : 'Choose which account in the export belongs to you.'}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          {restoreMode
            ? 'Unmapped users are imported as guests.'
            : 'Only flights belonging to this account will be imported.'}
        </p>
      </div>
    </div>

    {#await usersPromise then users}
      <div class="space-y-2">
        {#each exportedUsers as exportedUser (exportedUser.id)}
          <div class="flex items-center gap-3">
            <div class="w-48 shrink-0">
              <div class="text-sm font-medium">{exportedUser.displayName}</div>
              <div class="text-xs text-muted-foreground">
                @{exportedUser.username}
              </div>
            </div>
            <div class="flex-1">
              <Select.Root
                type="single"
                value={localMapping[exportedUser.id] ?? ''}
                onValueChange={(value) =>
                  setUserMapping(exportedUser.id, value ?? '')}
              >
                <Select.Trigger disabled={busy}>
                  {#if localMapping[exportedUser.id]}
                    {@const selectedUser = users.find(
                      (user) => user.id === localMapping[exportedUser.id],
                    )}
                    {#if selectedUser}
                      {selectedUser.displayName} (@{selectedUser.username})
                    {:else}
                      {restoreMode ? 'Select local user...' : 'Not me'}
                    {/if}
                  {:else}
                    {restoreMode ? 'No mapping (import as guest)' : 'Not me'}
                  {/if}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item
                    value=""
                    label={restoreMode
                      ? 'No mapping (import as guest)'
                      : 'Not me'}
                  />
                  {#each selectableUsers(users) as user (user.id)}
                    <Select.Item
                      value={user.id}
                      label={`${user.displayName} (@${user.username})`}
                    />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
        <p class="text-xs text-muted-foreground">
          {#if restoreMode}
            {mappedCount} of {exportedUsers.length} users mapped
          {:else}
            {canContinue
              ? 'Your exported account is selected'
              : 'Select your exported account to continue'}
          {/if}
        </p>
      </div>
    {/await}

    <div class="mt-4 flex justify-between">
      <Button variant="outline" onclick={() => onback?.()} disabled={busy}
        >Back</Button
      >
      <Button
        onclick={() => onnext?.(localMapping)}
        disabled={busy || !canContinue}>Continue Import</Button
      >
    </div>
  </Card>
</div>
