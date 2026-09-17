import type { Cookies } from '@sveltejs/kit';

export const OAUTH_REQUEST_COOKIE = 'airtrail_oauth_request';

/*
 * Where to send a user once they have just signed in. The pending OAuth
 * authorization request lives in an httpOnly cookie set by /oauth/authorize;
 * both the password login and the OAuth callback resume from it through here so
 * the rule lives in one place. The old `?oauth_request=` query parameter was
 * never read by anything and has been removed.
 */
export const postLoginTarget = (cookies: Cookies) => {
  const pending = cookies.get(OAUTH_REQUEST_COOKIE);
  return pending ? `/oauth/consent?id=${encodeURIComponent(pending)}` : '/';
};
