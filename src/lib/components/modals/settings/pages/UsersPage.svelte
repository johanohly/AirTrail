<script lang="ts">
  import { PageHeader } from '.';
  import { api } from '$lib/trpc';
  import type { User } from '$lib/db';
  import { toTitleCase } from '$lib/utils';
  import { LoaderCircle, SquarePen, X } from '@o7/icon/lucide';
  import { Card } from '$lib/components/ui/card';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';

  let loading = $state(true);
  let users: User[] = $state([]);

  $effect(() => {
    api.user.list
      .query()
      .then((data) => {
        users = data;
      })
      .catch(() => {
        toast.error('You do not have permission to view this page.');
        location.reload();
      })
      .finally(() => {
        loading = false;
      });
    loading = false;
  });
</script>

<PageHeader title="Users" subtitle="Manage who can access AirTrail.">
  {#if loading}
    <LoaderCircle class="animate-spin" />
  {:else if users.length === 0}
    <p>No users found.</p>
  {:else}
    <div class="space-y-2">
      {#each users as user}
        <Card level="2" class="flex items-center p-3">
          <div class="flex items-center flex-1 h-full min-w-0">
            <div class="flex flex-col min-w-0 w-2/5">
              <h4 class="leading-4 truncate">{user.displayName}</h4>
              <p class="text-sm text-muted-foreground truncate">
                {toTitleCase(user.role)}
              </p>
            </div>
            <div class="flex flex-1 flex-col min-w-0">
              <p class="text-muted-foreground truncate">
                {user.username}
              </p>
              <p class="text-sm text-muted-foreground truncate">
                {toTitleCase(user.unit)}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button disabled variant="outline" size="icon">
              <SquarePen size="20" />
            </Button>
            <Button disabled variant="outline" size="icon">
              <X size="24" />
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</PageHeader>
