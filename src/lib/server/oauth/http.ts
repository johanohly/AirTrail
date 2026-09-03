import { json } from '@sveltejs/kit';

export const oauthError = (error: string, description: string, status = 400) =>
  json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
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

export const addOAuthRedirectError = (
  redirectUri: string,
  error: string,
  description: string,
  state: string | null,
) => {
  const target = new URL(redirectUri);
  target.searchParams.set('error', error);
  target.searchParams.set('error_description', description);
  if (state) target.searchParams.set('state', state);
  return target;
};
