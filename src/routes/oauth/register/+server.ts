import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { createClient } from '$lib/server/oauth/server';
import { oauthError, oauthRateLimited } from '$lib/server/oauth/http';
import {
  clientIdentity,
  RATE_LIMITS,
  rateLimiter,
} from '$lib/server/security/rate-limit';

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(100),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  token_endpoint_auth_method: z
    .enum(['none', 'client_secret_post'])
    .default('none'),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

const validRedirect = (value: string) => {
  const url = new URL(value);
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' ||
      url.hostname === 'localhost' ||
      url.hostname === '[::1]')
  );
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const limit = rateLimiter.check(
    RATE_LIMITS.oauthRegister,
    clientIdentity(getClientAddress),
  );
  if (!limit.allowed) return oauthRateLimited(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError('invalid_client_metadata', 'Request body must be JSON');
  }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success || !parsed.data.redirect_uris.every(validRedirect)) {
    return oauthError(
      'invalid_redirect_uri',
      'One or more redirect URIs are invalid',
    );
  }
  if (
    parsed.data.grant_types?.some(
      (value) => !['authorization_code', 'refresh_token'].includes(value),
    ) ||
    parsed.data.response_types?.some((value) => value !== 'code')
  ) {
    return oauthError(
      'invalid_client_metadata',
      'Only authorization code and refresh token grants are supported',
    );
  }
  // The redirect-uri table is keyed on (client_id, redirect_uri), so a repeated
  // URI would fail the whole insert.
  const redirectUris = [...new Set(parsed.data.redirect_uris)];
  const client = await createClient({
    name: parsed.data.client_name,
    redirectUris,
    tokenEndpointAuthMethod: parsed.data.token_endpoint_auth_method,
  });
  return json(
    {
      client_id: client.clientId,
      ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
      client_name: parsed.data.client_name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: parsed.data.token_endpoint_auth_method,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
};
