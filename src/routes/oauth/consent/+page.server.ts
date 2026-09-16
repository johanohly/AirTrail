import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { grantableScopes, isApiScope } from '$lib/api/v1/scopes';
import { addOAuthRedirectError } from '$lib/server/oauth/http';
import { issueAuthorizationCode, oauthScopes } from '$lib/server/oauth/server';
import { authorizationAllowsScope } from '$lib/server/api/v1/access';

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
  if (!locals.user)
    throw redirect(303, `/login?oauth_request=${encodeURIComponent(id ?? '')}`);
  if (!locals.authorization) throw error(401, 'Login is required');
  const request = id ? await loadRequest(id) : null;
  if (!request)
    throw error(
      400,
      'This authorization request has expired. Return to the app and try again.',
    );
  const resource = new URL(request.resource);
  return {
    id: request.id,
    clientName: request.clientName,
    resource: `${resource.host}${resource.pathname}`,
    authorizationTarget:
      resource.pathname === '/api/mcp' ? 'MCP server' : 'API',
    redirectHost: new URL(request.redirectUri).host,
    scopes: grantableScopes(locals.authorization),
  };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    if (!locals.user || !locals.authorization)
      throw error(401, 'Login is required');
    const form = await request.formData();
    const id = form.get('id');
    const decision = form.get('decision');
    const submittedScopeValues = form.getAll('scope');
    if (typeof id !== 'string')
      throw error(400, 'Invalid authorization request');
    const authRequest = await loadRequest(id);
    if (
      !authRequest ||
      (authRequest.userId && authRequest.userId !== locals.user.id)
    )
      throw error(400, 'This authorization request has expired');
    await db
      .deleteFrom('oauthAuthorizationRequest')
      .where('id', '=', id)
      .execute();
    cookies.delete('airtrail_oauth_request', { path: '/' });
    if (decision !== 'approve')
      throw redirect(
        303,
        addOAuthRedirectError(
          authRequest.redirectUri,
          'access_denied',
          'The user denied access',
          authRequest.state,
        ).href,
      );
    if (submittedScopeValues.some((scope) => typeof scope !== 'string'))
      throw redirect(
        303,
        addOAuthRedirectError(
          authRequest.redirectUri,
          'invalid_scope',
          'The submitted scopes are invalid',
          authRequest.state,
        ).href,
      );
    const submittedScopes = submittedScopeValues.filter(
      (scope): scope is string => typeof scope === 'string',
    );
    if (submittedScopes.some((scope) => !isApiScope(scope)))
      throw redirect(
        303,
        addOAuthRedirectError(
          authRequest.redirectUri,
          'invalid_scope',
          'The submitted scopes are invalid',
          authRequest.state,
        ).href,
      );
    const approvedScopes = oauthScopes(submittedScopes);
    const unavailable = approvedScopes.find(
      (scope) =>
        !authorizationAllowsScope(
          { authorization: locals.authorization! },
          scope,
        ),
    );
    if (unavailable)
      throw redirect(
        303,
        addOAuthRedirectError(
          authRequest.redirectUri,
          'invalid_scope',
          `The current role cannot grant ${unavailable}`,
          authRequest.state,
        ).href,
      );
    const code = await issueAuthorizationCode({
      clientId: authRequest.clientId,
      userId: locals.user.id,
      redirectUri: authRequest.redirectUri,
      scopes: approvedScopes,
      resource: authRequest.resource,
      codeChallenge: authRequest.codeChallenge,
    });
    const target = new URL(authRequest.redirectUri);
    target.searchParams.set('code', code);
    if (authRequest.state) target.searchParams.set('state', authRequest.state);
    throw redirect(303, target.href);
  },
};
