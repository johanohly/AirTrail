import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { MCP_DEFAULT_SCOPES } from '$lib/api/v1/scopes';
import { oauthError } from '$lib/server/oauth/http';
import { oauthScopes, validateRedirectUri } from '$lib/server/oauth/server';
import { generateString } from '$lib/server/utils/random';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
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
  if (
    resource !== `${url.origin}/api/v1` &&
    resource !== `${url.origin}/api/mcp`
  )
    return oauthError(
      'invalid_target',
      'resource must identify this AirTrail API or MCP endpoint',
    );
  const requested =
    requestedByClient.length === 0 && resource === `${url.origin}/api/mcp`
      ? [...MCP_DEFAULT_SCOPES]
      : requestedByClient;
  if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge))
    return oauthError(
      'invalid_request',
      'code_challenge must be an S256 challenge',
    );
  const scopes = oauthScopes(requested);
  if (scopes.length !== requested.length)
    return oauthError('invalid_scope', 'One or more scopes are unsupported');
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
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })
    .execute();
  cookies.set('airtrail_oauth_request', requestId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600,
  });
  if (!locals.user)
    throw redirect(
      303,
      `/login?oauth_request=${encodeURIComponent(requestId)}`,
    );
  throw redirect(303, `/oauth/consent?id=${encodeURIComponent(requestId)}`);
};
