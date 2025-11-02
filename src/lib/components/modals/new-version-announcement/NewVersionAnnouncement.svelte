<script lang="ts">
  import SvelteMarkdown from 'svelte-markdown';

  import NewTabLink from './NewTabLink.svelte';

  import * as Dialog from '$lib/components/ui/alert-dialog';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { versionState } from '$lib/state.svelte';
  import { checkForNewVersions } from '$lib/utils/version';

  let open = $state(false);

  $effect(() => {
    checkForNewVersions().then(() => {
      if (versionState.newReleases.length > 0) {
        open = true;
      }
    });
  });

  const dismissVersion = () => {
    if (!versionState.latestVersion) return;

    // Store the latest version as dismissed
    localStorage.setItem('dismissedVersion', versionState.latestVersion);
    versionState.dismissedVersion = versionState.latestVersion;
    open = false;
  };
</script>

{#if versionState.newReleases.length > 0}
  <Dialog.Root bind:open>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title
          class={versionState.newReleases.length === 1
            ? 'flex items-center gap-2'
            : 'space-y-2'}
        >
          {#if versionState.newReleases.length === 1}
            <div class="flex items-center gap-2">
              New version available!
              <Badge>{versionState.newReleases[0].name}</Badge>
            </div>
          {:else}
            <div>
              {versionState.newReleases.length} new versions available!
            </div>
            <div class="flex flex-wrap gap-2">
              {#each versionState.newReleases as changelog (changelog.name)}
                <Badge>{changelog.name}</Badge>
              {/each}
            </div>
          {/if}
        </Dialog.Title>
      </Dialog.Header>
      <div class="prose max-h-[80dvh] overflow-y-auto space-y-6">
        {#each versionState.newReleases as changelog (changelog.name)}
          <div class="border-b border-gray-200 pb-4 last:border-b-0">
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              Version {changelog.name}
            </h3>
            <SvelteMarkdown
              source={changelog.body}
              renderers={{ link: NewTabLink }}
            />
          </div>
        {/each}
      </div>
      <Dialog.Footer>
        <Button
          variant="outline"
          href="https://airtrail.johan.ohly.dk/docs/install/updating"
          target="_blank"
        >
          How to update
        </Button>
        <Dialog.Action onclick={dismissVersion}>Got it</Dialog.Action>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
