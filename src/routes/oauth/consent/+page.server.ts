import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import {
  authorizationAllowsScope,
  grantableScopes,
  isApiScope,
  isGrantableScope,
  type ApiScope,
} from '$lib/api/v1/scopes';
import { oauthRedirectError } from '$lib/server/oauth/http';
import { OAUTH_REQUEST_COOKIE } from '$lib/server/oauth/resume';
import { issueAuthorizationCode, oauthScopes } from '$lib/server/oauth/server';

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

export const load: PageServerLoad = async ({ url, locals }) => {
  const id = url.searchParams.get('id');
  if (!locals.user) throw redirect(303, '/login');
  if (!locals.authorization) throw error(401, 'Login is required');
  const request = id ? await loadRequest(id) : null;
  if (!request)
    throw error(
      400,
      'This authorization request has expired. Return to the app and try again.',
    );
  const resource = new URL(request.resource);
  const grantable = grantableScopes(locals.authorization);
  const requested = new Set(request.scopes.filter(isApiScope));
  return {
    id: request.id,
    clientName: request.clientName,
    resource: `${resource.host}${resource.pathname}`,
    authorizationTarget:
      resource.pathname === '/api/mcp' ? 'MCP server' : 'API',
    redirectHost: new URL(request.redirectUri).host,
    /*
     * Every scope the user *could* grant is still shown, so they can widen the
     * grant deliberately, but only the ones the client actually asked for are
     * pre-selected. Pre-checking everything read-only meant the default action
     * on an admin account handed over flight.read.any and users.directory.read
     * to a client that had asked for nothing but profile.read.
     */
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

    /*
     * The request id must match the cookie set by /oauth/authorize. Without
     * this, a request created while logged out (userId null) could be approved
     * by any signed-in user who learned its id.
     */
    if (cookies.get(OAUTH_REQUEST_COOKIE) !== id)
      throw error(400, 'This authorization request has expired');

    const authRequest = await loadRequest(id);
    if (!authRequest || (authRequest.userId && authRequest.userId !== user.id))
      throw error(400, 'This authorization request has expired');

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

    if (!submitted.every(isApiScope))
      throw deny('invalid_scope', 'The submitted scopes are invalid');

    const approved = oauthScopes(submitted);
    const rejected = approved.find(
      (scope: ApiScope) =>
        !isGrantableScope(scope) ||
        !authorizationAllowsScope(authorization, scope),
    );
    if (rejected)
      throw deny('invalid_scope', `The current role cannot grant ${rejected}`);

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
