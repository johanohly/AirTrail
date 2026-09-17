import { verifyArgon2 } from '$lib/server/utils/hash';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { oauthError, tokenResponse } from '$lib/server/oauth/http';
import {
  consumeAuthorizationCode,
  issueTokens,
  oauthScopes,
  rotateRefreshToken,
} from '$lib/server/oauth/server';

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value : null;
};

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const grantType = formValue(form, 'grant_type');
  const resource = formValue(form, 'resource');
  const clientId = formValue(form, 'client_id');
  if (!grantType || !resource || !clientId)
    return oauthError(
      'invalid_request',
      'grant_type, resource, and client_id are required',
    );
  const client = await db
    .selectFrom('oauthClient')
    .selectAll()
    .where('id', '=', clientId)
    .executeTakeFirst();
  if (!client)
    return oauthError('invalid_client', 'Client authentication failed', 401);
  const clientSecret = formValue(form, 'client_secret');
  if (
    client.tokenEndpointAuthMethod === 'client_secret_post' &&
    (!client.clientSecretHash ||
      !clientSecret ||
      !(await verifyArgon2(client.clientSecretHash, clientSecret)))
  ) {
    return oauthError('invalid_client', 'Client authentication failed', 401);
  }
  if (grantType === 'refresh_token') {
    const refresh = formValue(form, 'refresh_token');
    if (!refresh)
      return oauthError('invalid_request', 'refresh_token is required');
    const tokens = await rotateRefreshToken(refresh, resource, clientId);
    return tokens
      ? tokenResponse(tokens)
      : oauthError('invalid_grant', 'Refresh token is invalid or expired');
  }
  if (grantType !== 'authorization_code')
    return oauthError(
      'unsupported_grant_type',
      'Only authorization_code and refresh_token are supported',
    );
  const code = formValue(form, 'code');
  const verifier = formValue(form, 'code_verifier');
  const redirectUri = formValue(form, 'redirect_uri');
  if (!code || !clientId || !verifier || !redirectUri)
    return oauthError(
      'invalid_request',
      'code, client_id, redirect_uri, and code_verifier are required',
    );
  const row = await consumeAuthorizationCode({
    code,
    clientId,
    redirectUri,
    resource,
    verifier,
  });
  if (!row)
    return oauthError(
      'invalid_grant',
      'Authorization code is invalid or expired',
    );
  return tokenResponse(
    await issueTokens({ ...row, scopes: oauthScopes(row.scopes) }),
  );
};
