import { json } from '@sveltejs/kit';

import { API_SCOPES } from '$lib/api/v1/scopes';

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
 * RFC 6749 has no dedicated status for throttling, so `429` with the
 * extensible `temporarily_unavailable` code is used -- the closest fit in the
 * registry, and what clients already treat as retryable.
 */
export const oauthRateLimited = (retryAfterSeconds: number) =>
  oauthError(
    'temporarily_unavailable',
    'Too many requests. Retry later.',
    429,
    { 'Retry-After': String(retryAfterSeconds) },
  );

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
export const protectedResourceMetadata = (origin: string, path: string) =>
  json(
    {
      resource: `${origin}${path}`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      scopes_supported: API_SCOPES,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
