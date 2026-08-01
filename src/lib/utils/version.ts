import semver, { SemVer } from 'semver';

import { version } from '$app/environment';
import { versionState } from '$lib/state.svelte';
import {
  readDismissedVersion,
  writeDismissedVersion,
} from '$lib/utils/version-storage';

interface GitHubRelease {
  tag_name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

type StableRelease = Pick<GitHubRelease, 'tag_name' | 'body'>;

interface ReleaseCache {
  fetchedAt: number;
  appVersion: string;
  releases: StableRelease[];
}

const RELEASE_CACHE_KEY = 'airtrail:changelog:last-updated';
// Unauthenticated GitHub API allows 60 requests/hour per IP; shared-IP
// installs would hit the limit if we fetched on every page load
const RELEASE_CACHE_TTL = 6 * 60 * 60 * 1000;

function readReleaseCache(): StableRelease[] | null {
  try {
    const raw = localStorage.getItem(RELEASE_CACHE_KEY);
    if (!raw) return null;

    const cache: ReleaseCache = JSON.parse(raw);
    if (cache.appVersion !== version) return null;
    if (Date.now() - cache.fetchedAt > RELEASE_CACHE_TTL) return null;
    return cache.releases;
  } catch {
    return null;
  }
}

async function fetchStableReleases(): Promise<StableRelease[] | null> {
  const cached = readReleaseCache();
  if (cached) return cached;

  const response = await fetch(
    'https://api.github.com/repos/johanohly/AirTrail/releases',
  );

  if (!response.ok) return null;

  const data: GitHubRelease[] = await response.json();
  const releases = data
    .filter((release) => !release.draft && !release.prerelease)
    .map(({ tag_name, body }) => ({ tag_name, body }));

  try {
    localStorage.setItem(
      RELEASE_CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        appVersion: version,
        releases,
      } satisfies ReleaseCache),
    );
  } catch {
    // Storage full or unavailable; skip caching
  }

  return releases;
}

/**
 * Fetch and check for new versions from GitHub
 * Updates versionState with filtered releases and latest version
 */
export async function checkForNewVersions(): Promise<void> {
  versionState.isChecking = true;
  versionState.currentVersion = version;

  try {
    const releases = await fetchStableReleases();
    if (!releases) {
      versionState.isChecking = false;
      return;
    }

    const dismissedVersion = readDismissedVersion();
    const currentVersion = new SemVer(version);

    const newReleases: Array<{ name: string; body: string }> = [];
    let latestVersion: SemVer | null = null;

    for (const release of releases) {
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

    versionState.alreadyChecked = true;
    versionState.isChecking = false;
  } catch (error) {
    console.error('Failed to check for new versions:', error);
    versionState.isChecking = false;
  }
}

export function dismissLatestVersion(): void {
  const latestVersion = versionState.latestVersion;
  if (!latestVersion) return;

  writeDismissedVersion(latestVersion);
}
