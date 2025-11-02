import semver, { SemVer } from 'semver';

import { version } from '$app/environment';
import { versionState } from '$lib/state.svelte';

interface GitHubRelease {
  tag_name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Fetch and check for new versions from GitHub
 * Updates versionState with filtered releases and latest version
 */
export async function checkForNewVersions(): Promise<void> {
  versionState.isChecking = true;
  versionState.currentVersion = version;

  try {
    const response = await fetch(
      'https://api.github.com/repos/johanohly/AirTrail/releases',
    );

    if (!response.ok) {
      versionState.isChecking = false;
      return;
    }

    const data: GitHubRelease[] = await response.json();
    const dismissedVersion = localStorage.getItem('dismissedVersion');
    const currentVersion = new SemVer(version);

    const newReleases: Array<{ name: string; body: string }> = [];
    let latestVersion: SemVer | null = null;

    for (const release of data) {
      // Skip draft and prerelease versions
      if (release.draft || release.prerelease) continue;

      const releaseVersion = new SemVer(release.tag_name);

      // Track the overall latest version (for display in settings)
      if (!latestVersion || semver.gt(releaseVersion, latestVersion)) {
        latestVersion = releaseVersion;
      }

      // Check if this release should be shown in announcement
      const isNewerThanCurrent = semver.gt(releaseVersion, currentVersion);
      const isNotDismissed =
        !dismissedVersion || semver.gt(releaseVersion, dismissedVersion);

      if (isNewerThanCurrent && isNotDismissed) {
        newReleases.push({
          name: release.tag_name,
          body: release.body,
        });
      }
    }

    // Update state
    versionState.newReleases = newReleases;
    versionState.latestVersion = latestVersion ? latestVersion.version : null;

    versionState.dismissedVersion = dismissedVersion;
    versionState.alreadyChecked = true;
    versionState.isChecking = false;
  } catch (error) {
    console.error('Failed to check for new versions:', error);
    versionState.isChecking = false;
  }
}
