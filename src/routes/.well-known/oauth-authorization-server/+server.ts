import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_SCOPES } from '$lib/api/v1/scopes';

export const GET: RequestHandler = ({ url }) => {
  const issuer = url.origin;
  return json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      scopes_supported: API_SCOPES,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
};
