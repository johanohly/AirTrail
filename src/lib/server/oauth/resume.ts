import type { Cookies } from '@sveltejs/kit';

export const OAUTH_REQUEST_COOKIE = 'airtrail_oauth_request';

/*
 * Where to send a user once they have just signed in: back to a pending OAuth
 * authorization request, which /oauth/authorize keeps in an httpOnly cookie.
 */
export const postLoginTarget = (cookies: Cookies) => {
  const pending = cookies.get(OAUTH_REQUEST_COOKIE);
  return pending ? `/oauth/consent?id=${encodeURIComponent(pending)}` : '/';
};
