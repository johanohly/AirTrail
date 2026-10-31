export const INCLUDE_UPCOMING_KEY = 'airtrail:statistics:include-upcoming';

export function readIncludeUpcoming(): boolean {
  try {
    return localStorage.getItem(INCLUDE_UPCOMING_KEY) === 'true';
  } catch {
    // Storage can be unavailable, e.g. in private mode.
    return false;
  }
}

export function writeIncludeUpcoming(include: boolean): void {
  try {
    localStorage.setItem(INCLUDE_UPCOMING_KEY, String(include));
  } catch {
    // Storage can be unavailable, e.g. in private mode.
  }
}
