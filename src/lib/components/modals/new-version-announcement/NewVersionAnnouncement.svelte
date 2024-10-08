<script lang="ts">
  import * as Dialog from '$lib/components/ui/alert-dialog';
  import SvelteMarkdown from 'svelte-markdown';
  import NewTabLink from './NewTabLink.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { version } from '$app/environment';
  import semver, { SemVer } from 'semver';
  import { Button } from '$lib/components/ui/button';

  let open = $state(false);
  let changelog: { name: string; body: string } | null = $state(null);
  $effect(() => {
    fetch(
      'https://api.github.com/repos/johanohly/AirTrail/releases/latest',
    ).then(async (response) => {
      if (!response.ok) return;

      const data = await response.json();
      const latestVersion = new SemVer(data.tag_name);
      const dismissedVersion = localStorage.getItem('dismissedVersion');

      // If the latest version is the same as the current version or the new version has been dismissed, return
      if (
        semver.lte(latestVersion, version) ||
        (dismissedVersion && semver.lte(latestVersion, dismissedVersion))
      ) {
        return;
      }

      changelog = {
        name: data.tag_name,
        body: data.body,
      };
      open = true;
    });
  });

  const dismissVersion = () => {
    if (!changelog) return;
    localStorage.setItem('dismissedVersion', changelog?.name);
  };
</script>

{#if changelog}
  <Dialog.Root bind:open>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-4">
          New version available!
          <Badge>{changelog.name}</Badge>
        </Dialog.Title>
      </Dialog.Header>
      <div class="prose max-h-[80dvh] overflow-y-auto">
        <SvelteMarkdown
          source={changelog.body}
          renderers={{ link: NewTabLink }}
        />
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
