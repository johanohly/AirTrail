export type ViewParam = 'flights' | 'statistics';

const VIEW_PATHS = {
  flights: '/flights',
  statistics: '/statistics',
} as const;

export function viewPath(view: ViewParam): '/flights' | '/statistics' {
  return VIEW_PATHS[view];
}

/**
 * The path a view modal pushes onto history, or undefined when the current
 * page isn't the map page (share pages etc. must stay inert).
 */
export function urlForView(view: ViewParam): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.location.pathname !== '/') return undefined;
  return viewPath(view);
}

export function readViewFromPath(): ViewParam | undefined {
  if (typeof window === 'undefined') return undefined;
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/flights') return 'flights';
  if (pathname === '/statistics') return 'statistics';
  return undefined;
}

/**
 * Rewrites the current history entry to `/` while keeping sibling query
 * params (e.g. `?onboarding`), the hash, and SvelteKit's history state keys.
 */
export function stripViewPath(): void {
  if (typeof window === 'undefined') return;
  history.replaceState(
    { ...(history.state as Record<string, unknown> | null) },
    '',
    `/${window.location.search}${window.location.hash}`,
  );
}
