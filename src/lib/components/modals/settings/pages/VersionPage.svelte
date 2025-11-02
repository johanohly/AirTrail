<script lang="ts">
  import { version } from '$app/environment';

  import { PageHeader } from '.';
  import { versionState } from '$lib/state.svelte';
  import { checkForNewVersions } from '$lib/utils/version';

  $effect(() => {
    if (!versionState.alreadyChecked && !versionState.isChecking) {
      checkForNewVersions();
    }
  });
</script>

<PageHeader
  title="Version"
  subtitle="View version information and check for updates."
>
  <div class="space-y-4">
    <div class="space-y-2">
      <h3 class="text-sm font-medium">Current Version</h3>
      <p class="text-muted-foreground text-sm">
        <a
          href="https://github.com/johanohly/AirTrail/releases/tag/v{version}"
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono font-semibold text-primary hover:underline"
        >
          {version}
        </a>
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-medium">Latest Version</h3>
      <p class="text-muted-foreground text-sm">
        {#if versionState.isChecking}
          <span class="font-mono font-semibold">Checking...</span>
        {:else if versionState.latestVersion}
          <a
            href="https://github.com/johanohly/AirTrail/releases/tag/v{versionState.latestVersion}"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono font-semibold text-primary hover:underline"
          >
            {versionState.latestVersion}
          </a>
        {:else}
          <span class="font-mono font-semibold">Unable to get latest version.</span>
        {/if}
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-medium">Updating</h3>
      <a
        href="https://airtrail.johan.ohly.dk/docs/install/updating"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-primary hover:underline"
      >
        How to update
      </a>
    </div>
  </div>
</PageHeader>
