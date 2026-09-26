<script lang="ts">
  import { X } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/trpc';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import { Confirm } from '$lib/components/helpers';
  import { accessSummary } from '$lib/authorization/access-presentation';

  type ConnectedApp = Awaited<
    ReturnType<typeof api.user.listConnectedApps.query>
  >[number];
  let apps = $state<ConnectedApp[]>([]);
  let loaded = $state(false);
  const refresh = async () => {
    apps = await api.user.listConnectedApps.query();
    loaded = true;
  };
  const revoke = async (id: string) => {
    await api.user.revokeConnectedApp.mutate(id);
    await refresh();
    toast.success('Connected app revoked');
  };
  $effect(() => {
    refresh();
  });
</script>

<Collapsible
  title="Connected apps"
  subtitle="Apps authorized through OAuth"
  disabled={!loaded}
>
  {#each apps as app}
    <Card class="flex items-center justify-between p-3">
      <div class="min-w-0">
        <h4 class="font-medium">{app.name}</h4>
        <p class="truncate text-sm text-muted-foreground" title={app.resource}>
          {app.resource}
        </p>
        <p
          class="truncate text-xs text-muted-foreground"
          title={app.scopes.join(', ')}
        >
          {accessSummary(app.scopes)}
        </p>
      </div>
      <Confirm
        title="Revoke connected app"
        description={`Revoke ${app.name}'s access?`}
        onConfirm={() => revoke(app.id)}
      >
        {#snippet triggerContent({ props })}<Button
            variant="outline"
            size="icon"
            {...props}
            title="Revoke access"><X size={16} /></Button
          >{/snippet}
      </Confirm>
    </Card>
  {:else}
    <p class="text-center text-sm text-muted-foreground">No connected apps</p>
  {/each}
</Collapsible>
