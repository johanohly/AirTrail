<script lang="ts">
  import ReleaseNotes from './ReleaseNotes.svelte';

  import * as Dialog from '$lib/components/ui/alert-dialog';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { versionState } from '$lib/state.svelte';
  import { checkForNewVersions } from '$lib/utils/version';

  let { previewReleaseTag }: { previewReleaseTag?: string } = $props();
  let open = $state(false);

  const loadPreviewRelease = async (tag: string) => {
    const response = await fetch(
      `https://api.github.com/repos/johanohly/AirTrail/releases/tags/${tag}`,
    );

    if (!response.ok) return false;

    const release: { tag_name: string; body: string } = await response.json();
    versionState.newReleases = [{ name: release.tag_name, body: release.body }];
    versionState.latestVersion = release.tag_name.replace(/^v/, '');
    return true;
  };

  $effect(() => {
    const releaseTag = previewReleaseTag;

    void (async () => {
      if (releaseTag) {
        open = await loadPreviewRelease(releaseTag);
        return;
      }

      await checkForNewVersions();
      open = versionState.newReleases.length > 0;
    })();
  });

  const dismissVersion = () => {
    if (previewReleaseTag) {
      open = false;
      return;
    }

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
              <Badge>{versionState.newReleases[0]?.name}</Badge>
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
      <div class="max-h-[80dvh] space-y-6 overflow-y-auto">
        {#each versionState.newReleases as changelog (changelog.name)}
          <div class="border-b border-gray-200 pb-4 last:border-b-0">
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              Version {changelog.name}
            </h3>
            <div class="typeset typeset-docs max-w-[37em]">
              <ReleaseNotes source={changelog.body} />
            </div>
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
