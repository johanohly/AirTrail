/*
 * SvelteKit's origin check, reimplemented because the built-in one (turned off
 * in svelte.config.js) runs before routing with no way to exempt a route. The
 * OAuth token and revocation endpoints must accept form POSTs from non-browser
 * clients, which send no Origin (RFC 6749 3.2, 4.1.3). They authenticate from
 * the request body and never read cookies, so exempting them leaves no ambient
 * authority to borrow; every cookie-authenticated form endpoint stays checked.
 *
 * SvelteKit's remote-function origin check is not affected by the option. The
 * app uses no `$app/remote`; adopting it would need the same exemption.
 */

import { mediaType } from '$lib/server/utils/http';

/** Content types a browser can produce from a plain form, per SvelteKit. */
const FORM_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const CSRF_EXEMPT_PATHS = new Set(['/oauth/token', '/oauth/revoke']);

export const isCrossSiteFormPost = (request: {
  method: string;
  pathname: string;
  contentType: string | null;
  origin: string | null;
  expectedOrigin: string;
}) => {
  if (CSRF_EXEMPT_PATHS.has(request.pathname)) return false;
  if (!MUTATING_METHODS.has(request.method)) return false;
  if (!FORM_CONTENT_TYPES.has(mediaType(request.contentType))) return false;
  return request.origin !== request.expectedOrigin;
};
