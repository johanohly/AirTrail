export const DISMISSED_VERSION_KEY = 'airtrail:changelog:dismissed-version';

export function readDismissedVersion(): string | null {
  return localStorage.getItem(DISMISSED_VERSION_KEY);
}

export function writeDismissedVersion(version: string): void {
  localStorage.setItem(DISMISSED_VERSION_KEY, version);
}
