<script lang="ts">
  import { Users } from '@o7/icon/lucide';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { api } from '$lib/trpc';

  let {
    exportedUsers = [],
    userMapping = {},
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
    busy?: boolean;
    onback?: () => void;
    onnext?: (userMapping: Record<string, string>) => void;
  } = $props();

  const usersPromise = api.user.list.query();

  let localMapping = $state<Record<string, string>>({ ...userMapping });

  const mappedCount = $derived(Object.keys(localMapping).length);

  const setUserMapping = (exportedUserId: string, mappedUserId: string) => {
    if (mappedUserId) {
      localMapping[exportedUserId] = mappedUserId;
    } else {
      delete localMapping[exportedUserId];
    }
  };
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Map exported users</h3>

  <Card class="p-4 space-y-4">
    <div class="flex items-start gap-3">
      <Users class="text-muted-foreground mt-0.5 shrink-0" size={20} />
      <div>
        <p class="text-sm">Review and adjust user mapping before import.</p>
        <p class="text-xs text-muted-foreground mt-1">
          Username matches are pre-selected when possible.
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
              <select
                class="w-full rounded-md border bg-background px-3 py-2 text-sm"
                disabled={busy}
                value={localMapping[exportedUser.id] ?? ''}
                onchange={(event) =>
                  setUserMapping(
                    exportedUser.id,
                    (event.currentTarget as HTMLSelectElement).value,
                  )}
              >
                <option value="">No mapping (import as guest)</option>
                {#each users as user (user.id)}
                  <option value={user.id}
                    >{user.displayName} (@{user.username})</option
                  >
                {/each}
              </select>
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-4 p-3 bg-muted/30 rounded-md border border-muted">
        <p class="text-xs text-muted-foreground">
          {mappedCount} of {exportedUsers.length} users mapped
        </p>
      </div>
    {/await}

    <div class="mt-4 flex justify-between">
      <Button variant="outline" onclick={() => onback?.()} disabled={busy}
        >Back</Button
      >
      <Button onclick={() => onnext?.(localMapping)} disabled={busy}
        >Continue Import</Button
      >
    </div>
  </Card>
</div>
