import { error, redirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { protectedResourceKey } from '$lib/api/v1/resources';
import {
  grantableScopes,
  grantableSubset,
  parseScopes,
} from '$lib/api/v1/scopes';
import { oauthRedirectError } from '$lib/server/oauth/http';
import { OAUTH_REQUEST_COOKIE } from '$lib/server/oauth/resume';
import { issueAuthorizationCode } from '$lib/server/oauth/server';

const EXPIRED =
  'This authorization request has expired. Return to the app and try again.';

const loadRequest = (id: string) =>
  db
    .selectFrom('oauthAuthorizationRequest')
    .innerJoin(
      'oauthClient',
      'oauthClient.id',
      'oauthAuthorizationRequest.clientId',
    )
    .selectAll('oauthAuthorizationRequest')
    .select('oauthClient.name as clientName')
    .where('oauthAuthorizationRequest.id', '=', id)
    .where('oauthAuthorizationRequest.expiresAt', '>', new Date())
    .executeTakeFirst();

/*
 * The pending request, only when its id matches the cookie /oauth/authorize set
 * in this browser and it belongs to (or is not yet bound to) the signed-in
 * user. Without that binding any signed-in user who learned an id could read
 * or approve someone else's request.
 */
const loadBoundRequest = async (
  id: string | null,
  userId: string,
  cookies: Cookies,
) => {
  if (!id || cookies.get(OAUTH_REQUEST_COOKIE) !== id)
    throw error(400, EXPIRED);
  const request = await loadRequest(id);
  if (!request || (request.userId && request.userId !== userId))
    throw error(400, EXPIRED);
  return request;
};

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
  const id = url.searchParams.get('id');
  if (!locals.user) throw redirect(303, '/login');
  if (!locals.authorization) throw error(401, 'Login is required');
  const request = await loadBoundRequest(id, locals.user.id, cookies);
  const resource = new URL(request.resource);
  const grantable = grantableScopes(locals.authorization);
  const requested = new Set(parseScopes(request.scopes));
  return {
    id: request.id,
    clientName: request.clientName,
    resource: `${resource.host}${resource.pathname}`,
    authorizationTarget:
      protectedResourceKey(url.origin, request.resource) === 'mcp'
        ? 'MCP server'
        : 'API',
    redirectHost: new URL(request.redirectUri).host,
    // Every grantable scope is shown, but only the requested ones start selected.
    scopes: grantable.map((scope) => ({
      ...scope,
      requested: requested.has(scope.name),
    })),
  };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const { user, authorization } = locals;
    if (!user || !authorization) throw error(401, 'Login is required');

    const form = await request.formData();
    const id = form.get('id');
    const decision = form.get('decision');
    const submitted = form
      .getAll('scope')
      .filter((value): value is string => typeof value === 'string');

    if (typeof id !== 'string')
      throw error(400, 'Invalid authorization request');
    const authRequest = await loadBoundRequest(id, user.id, cookies);

    await db
      .deleteFrom('oauthAuthorizationRequest')
      .where('id', '=', id)
      .execute();
    cookies.delete(OAUTH_REQUEST_COOKIE, { path: '/' });

    const deny = (code: string, description: string) =>
      redirect(
        303,
        oauthRedirectError(
          authRequest.redirectUri,
          code,
          description,
          authRequest.state,
        ),
      );

    if (decision !== 'approve')
      throw deny('access_denied', 'The user denied access');

    const approved = grantableSubset(authorization, submitted);
    if (!approved)
      throw deny(
        'invalid_scope',
        'The submitted scopes are invalid or not grantable by the current role',
      );

    const code = await issueAuthorizationCode({
      clientId: authRequest.clientId,
      userId: user.id,
      redirectUri: authRequest.redirectUri,
      scopes: approved,
      resource: authRequest.resource,
      codeChallenge: authRequest.codeChallenge,
    });
    const target = new URL(authRequest.redirectUri);
    target.searchParams.set('code', code);
    if (authRequest.state) target.searchParams.set('state', authRequest.state);
    throw redirect(303, target.href);
  },
};
