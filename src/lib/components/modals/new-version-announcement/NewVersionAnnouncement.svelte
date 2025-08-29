<script lang="ts">
  import semver, { SemVer } from 'semver';
  import SvelteMarkdown from 'svelte-markdown';

  import NewTabLink from './NewTabLink.svelte';

  import { version } from '$app/environment';
  import * as Dialog from '$lib/components/ui/alert-dialog';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';

  interface GitHubRelease {
    tag_name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
  }

  let open = $state(false);
  let changelogs: { name: string; body: string }[] = $state([]);
  $effect(() => {
    fetch('https://api.github.com/repos/johanohly/AirTrail/releases').then(
      async (response) => {
        if (!response.ok) return;

        const data: GitHubRelease[] = await response.json();
        const dismissedVersion = localStorage.getItem('dismissedVersion');
        const currentVersion = new SemVer("1.0.0");

        // Filter releases to show only those newer than current version and not dismissed
        const newReleases = data
          .filter((release: GitHubRelease) => {
            const releaseVersion = new SemVer(release.tag_name);
            const isNewerThanCurrent = semver.gt(
              releaseVersion,
              currentVersion,
            );
            const isNotDismissed =
              !dismissedVersion || semver.gt(releaseVersion, dismissedVersion);
            return (
              isNewerThanCurrent &&
              isNotDismissed &&
              !release.draft &&
              !release.prerelease
            );
          })
          .map((release: GitHubRelease) => ({
            name: release.tag_name,
            body: release.body,
          }));

        if (newReleases.length > 0) {
          changelogs = newReleases;
          open = true;
        }
      },
    );
  });

  const dismissVersion = () => {
    if (changelogs.length === 0) return;
    // Store the latest (highest) version from the current batch as dismissed
    const latestVersion = changelogs
      .map((c) => new SemVer(c.name))
      .sort((a, b) => semver.compare(b, a))[0];
    localStorage.setItem('dismissedVersion', latestVersion.version);
    open = false;
  };
</script>

{#if changelogs.length > 0}
  <Dialog.Root bind:open>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-4">
          {changelogs.length === 1
            ? 'New version available!'
            : `${changelogs.length} new versions available!`}
          <div class="flex gap-2">
            {#each changelogs as changelog (changelog.name)}
              <Badge>{changelog.name}</Badge>
            {/each}
          </div>
        </Dialog.Title>
      </Dialog.Header>
      <div class="prose max-h-[80dvh] overflow-y-auto space-y-6">
        {#each changelogs as changelog (changelog.name)}
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
