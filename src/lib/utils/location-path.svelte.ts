import { browser } from '$app/environment';
import { page } from '$app/state';

let popstateTick = $state(0);

if (browser) {
  // View modals push and pop history entries directly, without SvelteKit, so
  // `page.url.pathname` can lag the address bar. Re-read the location
  // whenever the browser lands on such an entry.
  window.addEventListener('popstate', () => {
    popstateTick += 1;
  });
}

/**
 * The real browser pathname. Reactive to SvelteKit navigations (via `page`)
 * and to raw history traversal (via the popstate tick), unlike
 * `page.url.pathname` alone.
 */
export const currentPathname = (): string => {
  void popstateTick;
  return browser ? window.location.pathname : page.url.pathname;
};
