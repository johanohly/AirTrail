<script lang="ts">
  import { ChevronRight } from '@o7/icon/lucide';
  import { Collapsible } from 'bits-ui';
  import { formatRelative } from 'date-fns';
  import { slide } from 'svelte/transition';

  import CreateKey from '$lib/components/modals/settings/pages/security-page/CreateKey.svelte';
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
            <Card class="p-2">
              <h4 class="font-medium text-lg">
                {key.name}
              </h4>
              <p class="text-muted-foreground text-sm">
                Created {formatRelative(key.createdAt, new Date())}
                {#if key.lastUsed}
                  ∙ Last used {formatRelative(key.lastUsed, new Date())}
                {/if}
              </p>
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
