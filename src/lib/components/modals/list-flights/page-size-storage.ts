export const FLIGHTS_PER_PAGE_KEY = 'airtrail:flights:per-page';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const DEFAULT_FLIGHTS_PER_PAGE = 20;

export function readFlightsPerPage(): number {
  try {
    const stored = localStorage.getItem(FLIGHTS_PER_PAGE_KEY);
    const parsed = stored === null ? NaN : Number(stored);
    return PAGE_SIZE_OPTIONS.includes(parsed)
      ? parsed
      : DEFAULT_FLIGHTS_PER_PAGE;
  } catch {
    // Storage can be unavailable, e.g. in private mode.
    return DEFAULT_FLIGHTS_PER_PAGE;
  }
}

export function writeFlightsPerPage(value: number): void {
  try {
    localStorage.setItem(FLIGHTS_PER_PAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable, e.g. in private mode.
  }
}
