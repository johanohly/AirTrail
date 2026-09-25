import type { RequestHandler } from './$types';
import { parseScopes } from '$lib/api/v1/scopes';
import {
  formValue,
  oauthError,
  oauthRateLimit,
  readForm,
  tokenResponse,
} from '$lib/server/oauth/http';
import {
  authenticateClient,
  consumeAuthorizationCode,
  issueTokens,
  rotateRefreshToken,
} from '$lib/server/oauth/server';
import { RATE_LIMITS } from '$lib/server/security/rate-limit';

export const POST: RequestHandler = async (event) => {
  const limited = oauthRateLimit(event, RATE_LIMITS.oauthToken);
  if (limited) return limited;
  const { request } = event;

  const form = await readForm(request);
  if (!form)
    return oauthError('invalid_request', 'Request body must be form-encoded');
  const grantType = formValue(form, 'grant_type');
  const resource = formValue(form, 'resource');
  const clientId = formValue(form, 'client_id');
  if (!grantType || !resource || !clientId)
    return oauthError(
      'invalid_request',
      'grant_type, resource, and client_id are required',
    );
  const client = await authenticateClient(
    clientId,
    formValue(form, 'client_secret'),
  );
  if (!client)
    return oauthError('invalid_client', 'Client authentication failed', 401);
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
  if (!code || !verifier || !redirectUri)
    return oauthError(
      'invalid_request',
      'code, redirect_uri, and code_verifier are required',
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
    await issueTokens({ ...row, scopes: parseScopes(row.scopes) }),
  );
};
