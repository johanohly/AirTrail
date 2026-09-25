import { json, type RequestEvent } from '@sveltejs/kit';

import { API_SCOPES } from '$lib/api/v1/scopes';
import {
  protectedResourceUrl,
  type ProtectedResourceKey,
} from '$lib/api/v1/resources';
import {
  checkRateLimit,
  type RateLimitRule,
} from '$lib/server/security/rate-limit';
import { mediaType } from '$lib/server/utils/http';

export const oauthError = (
  error: string,
  description: string,
  status = 400,
  headers: HeadersInit = {},
) =>
  json(
    { error, error_description: description },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        ...headers,
      },
    },
  );

/*
 * The throttling response for an unauthenticated OAuth endpoint, or null when
 * the caller is under `rule`. RFC 6749 has no dedicated status for throttling,
 * so `429` with the extensible `temporarily_unavailable` code is used, which
 * clients already treat as retryable.
 */
export const oauthRateLimit = (
  event: Pick<RequestEvent, 'getClientAddress'>,
  rule: RateLimitRule,
) => {
  const limit = checkRateLimit(event, rule);
  if (limit.allowed) return null;
  return oauthError(
    'temporarily_unavailable',
    'Too many requests. Retry later.',
    429,
    { 'Retry-After': String(limit.retryAfterSeconds) },
  );
};

export const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value : null;
};

/*
 * Every OAuth error must be a JSON object (RFC 6749 section 5.2), but
 * `request.formData()` throws on a non-form body. Returning undefined for
 * anything unreadable lets the handlers answer it as a protocol error.
 */
export const readForm = async (request: Request) => {
  const contentType = mediaType(request.headers.get('content-type'));
  if (
    contentType !== 'application/x-www-form-urlencoded' &&
    contentType !== 'multipart/form-data'
  )
    return undefined;
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
};

export const tokenResponse = (tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: 'Bearer';
}) =>
  json(
    {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      scope: tokens.scope,
    },
    { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
  );

/** Builds the redirect that reports an OAuth failure back to the client. */
export const oauthRedirectError = (
  redirectUri: string,
  error: string,
  description: string,
  state: string | null,
) => {
  const target = new URL(redirectUri);
  target.searchParams.set('error', error);
  target.searchParams.set('error_description', description);
  if (state) target.searchParams.set('state', state);
  return target.href;
};

/** RFC 9728 protected-resource metadata, shared by /api/v1 and /api/mcp. */
export const protectedResourceMetadata = (
  origin: string,
  resource: ProtectedResourceKey,
) =>
  json(
    {
      resource: protectedResourceUrl(origin, resource),
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      scopes_supported: API_SCOPES,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
