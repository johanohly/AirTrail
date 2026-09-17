/*
 * Reimplementation of SvelteKit's origin check, which is turned off in
 * svelte.config.js.
 *
 * Why it is replaced rather than configured: the built-in check runs in
 * `respond()` before routing and before hooks, so no route can opt out of it,
 * and its `trustedOrigins` allowance is consulted only when an Origin header is
 * present. The OAuth token and revocation endpoints must accept
 * `application/x-www-form-urlencoded` POSTs from non-browser clients (RFC 6749
 * sections 3.2 and 4.1.3), which send no Origin at all -- so the built-in
 * rejected every one of them with 403 in production while passing in dev, where
 * the check is compiled out.
 *
 * Exempting those two endpoints is sound rather than a trade: neither reads
 * cookies or `locals`. They authenticate from the request body (client secret,
 * authorization code plus PKCE verifier, or refresh token), so there is no
 * ambient authority for a cross-site form post to borrow. Every cookie-
 * authenticated form endpoint -- the consent action and the form-encoded save
 * handlers under /api -- stays protected.
 */

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
  const contentType =
    request.contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!FORM_CONTENT_TYPES.has(contentType)) return false;
  return request.origin !== request.expectedOrigin;
};
