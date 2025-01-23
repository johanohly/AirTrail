<script lang="ts">
  import autoAnimate from '@formkit/auto-animate';
  import { X } from '@o7/icon/lucide';
  import { formatRelative } from 'date-fns';
  import { toast } from 'svelte-sonner';

  import { Confirm } from '$lib/components/helpers';
  import CreateKey from '$lib/components/modals/settings/pages/security-page/CreateKey.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Collapsible } from '$lib/components/ui/collapsible';
  import type { ApiKey } from '$lib/db/types';
  import { api } from '$lib/trpc';

  let loaded = $state(false);
  let keys: ApiKey[] = $state([]);

  const fetchKeys = async () => {
    keys = await api.user.listApiKeys.query();
    loaded = true;
  };

  $effect(() => {
    fetchKeys();
  });

  const deleteKey = async (key: ApiKey) => {
    await api.user.deleteApiKey.mutate(key.id);
    await fetchKeys();
    toast.success('API key deleted');
  };
</script>

<Collapsible
  title="API Keys"
  subtitle="Manage your API keys"
  disabled={!loaded}
  class={{ 'opacity-80': !loaded }}
>
  <div use:autoAnimate class="space-y-2">
    {#each keys as key}
      <Card class="p-2 flex justify-between">
        <div>
          <h4 class="font-medium text-lg">
            {key.name}
          </h4>
          <p class="text-muted-foreground text-sm">
            Created {formatRelative(key.createdAt, new Date())}
            {#if key.lastUsed}
              ∙ Last used {formatRelative(key.lastUsed, new Date())}
            {/if}
          </p>
        </div>
        <div class="flex items-center pr-1">
          <Confirm
            title="Delete API Key"
            description="Are you sure you want to delete this API key? This action cannot be undone."
            onConfirm={async () => deleteKey(key)}
          >
            {#snippet triggerContent({ props })}
              <Button variant="outline" size="icon" {...props}>
                <X />
              </Button>
            {/snippet}
          </Confirm>
        </div>
      </Card>
    {:else}
      <p class="pb-2 text-center text-muted-foreground">No API keys found</p>
    {/each}
  </div>
  <CreateKey bind:keys />
</Collapsible>
