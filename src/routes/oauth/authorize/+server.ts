import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import {
  PROTECTED_RESOURCES,
  protectedResourceKey,
} from '$lib/api/v1/resources';
import { parseScopes } from '$lib/api/v1/scopes';
import { oauthError, oauthRateLimit } from '$lib/server/oauth/http';
import { OAUTH_REQUEST_COOKIE } from '$lib/server/oauth/resume';
import { RATE_LIMITS } from '$lib/server/security/rate-limit';
import {
  AUTHORIZATION_REQUEST_TTL_MS,
  cleanupExpiredOAuthRecords,
  validateRedirectUri,
} from '$lib/server/oauth/server';
import { generateString } from '$lib/server/utils/random';

export const GET: RequestHandler = async (event) => {
  const { url, locals, cookies } = event;
  /*
   * Answered with JSON rather than a redirect: `redirect_uri` has not been
   * validated yet, and echoing it before that check would be an open redirect.
   */
  const limited = oauthRateLimit(event, RATE_LIMITS.oauthAuthorize);
  if (limited) return limited;

  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const codeChallenge = url.searchParams.get('code_challenge');
  const method = url.searchParams.get('code_challenge_method');
  const resource = url.searchParams.get('resource');
  const state = url.searchParams.get('state');
  const requestedByClient =
    url.searchParams.get('scope')?.split(/\s+/).filter(Boolean) ?? [];
  if (
    !clientId ||
    !redirectUri ||
    responseType !== 'code' ||
    !codeChallenge ||
    method !== 'S256' ||
    !resource
  ) {
    return oauthError(
      'invalid_request',
      'client_id, redirect_uri, response_type=code, resource, and S256 PKCE are required',
    );
  }
  if (!(await validateRedirectUri(clientId, redirectUri)))
    return oauthError('invalid_request', 'redirect_uri is not registered');
  const resourceKey = protectedResourceKey(url.origin, resource);
  if (!resourceKey)
    return oauthError(
      'invalid_target',
      'resource must identify this AirTrail API or MCP endpoint',
    );
  const requested =
    requestedByClient.length === 0
      ? [...PROTECTED_RESOURCES[resourceKey].defaultScopes]
      : requestedByClient;
  if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge))
    return oauthError(
      'invalid_request',
      'code_challenge must be an S256 challenge',
    );
  const scopes = parseScopes(requested);
  if (scopes.length !== requested.length)
    return oauthError('invalid_scope', 'One or more scopes are unsupported');
  await cleanupExpiredOAuthRecords();
  const requestId = generateString();
  await db
    .insertInto('oauthAuthorizationRequest')
    .values({
      id: requestId,
      clientId,
      userId: locals.user?.id ?? null,
      redirectUri,
      scopes,
      resource,
      state,
      codeChallenge,
      expiresAt: new Date(Date.now() + AUTHORIZATION_REQUEST_TTL_MS),
    })
    .execute();
  cookies.set(OAUTH_REQUEST_COOKIE, requestId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: AUTHORIZATION_REQUEST_TTL_MS / 1000,
  });
  if (!locals.user) throw redirect(303, '/login');
  throw redirect(303, `/oauth/consent?id=${encodeURIComponent(requestId)}`);
};
