<script lang="ts">
  import { ChevronRight, X } from '@o7/icon/lucide';
  import { Collapsible } from 'bits-ui';
  import { formatRelative } from 'date-fns';
  import { slide } from 'svelte/transition';

  import { Confirm } from '$lib/components/helpers';
  import CreateKey from '$lib/components/modals/settings/pages/security-page/CreateKey.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import type { ApiKey } from '$lib/db/types';
  import { api } from '$lib/trpc';
  import { cn } from '$lib/utils';

  let open = $state(false);

  let loaded = $state(false);
  let keys: ApiKey[] = $state([]);

  $effect(() => {
    keys.length;

    api.user.listApiKeys.query().then((res) => {
      keys = res;
      loaded = true;
    });
  });
</script>

<Collapsible.Root
  bind:open
  disabled={!loaded}
  class={cn('flex flex-col p-4 rounded-lg border', { 'opacity-80': !loaded })}
>
  <Collapsible.Trigger class="flex justify-between text-left">
    <div class="space-y-0.5">
      <h4 class="font-medium leading-4">API Keys</h4>
      <p class="text-sm text-muted-foreground">Manage your API keys</p>
    </div>
    <div class="flex items-center justify-center">
      <ChevronRight class={cn('transition-transform', { 'rotate-90': open })} />
    </div>
  </Collapsible.Trigger>
  <Collapsible.Content forceMount>
    {#snippet child({ props, open })}
      {#if open}
        <div {...props} transition:slide class="mt-4 flex flex-col space-y-2">
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
                  onConfirm={async () => {
                    await api.user.deleteApiKey.mutate(key.id);
                    keys = keys.filter((k) => k.id !== key.id);
                  }}
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
            <p class="pb-2 text-center text-muted-foreground">
              No API keys found
            </p>
          {/each}
          <CreateKey bind:keys />
        </div>
      {/if}
    {/snippet}
  </Collapsible.Content>
</Collapsible.Root>
