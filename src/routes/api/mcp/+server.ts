import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { authenticateApiPrincipal } from '$lib/server/api/v1/principal';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { handleMcpRequest } from '$lib/server/mcp/server';
import { MCP_DEFAULT_SCOPES } from '$lib/api/v1/scopes';

const forbiddenOrigin = (request: Request, origin: string) => {
  const requestOrigin = request.headers.get('Origin');
  return requestOrigin && requestOrigin !== origin
    ? new Response('Forbidden origin', { status: 403 })
    : null;
};

const authenticateMcpRequest = async (request: Request, origin: string) => {
  const principal = await authenticateApiPrincipal(
    request,
    `${origin}/api/mcp`,
  );
  if (principal) return principal;

  const response = apiV1Unauthorized(MCP_DEFAULT_SCOPES.join(' '));
  response.headers.set(
    'WWW-Authenticate',
    `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp" scope="${MCP_DEFAULT_SCOPES.join(' ')}"`,
  );
  return response;
};

const methodNotAllowed = () =>
  new Response(null, {
    status: 405,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'private, no-store',
    },
  });

export const POST: RequestHandler = async ({ request, url }) => {
  const originError = forbiddenOrigin(request, url.origin);
  if (originError) return originError;

  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;

  try {
    return await handleMcpRequest(request, principal);
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const GET: RequestHandler = async ({ request, url }) => {
  const originError = forbiddenOrigin(request, url.origin);
  if (originError) return originError;

  if (!request.headers.get('Accept')?.includes('text/event-stream')) {
    return json(
      {
        name: 'AirTrail',
        protocol: 'Model Context Protocol',
        transport: {
          type: 'streamable-http',
          endpoint: `${url.origin}/api/mcp`,
          stateless: true,
        },
        authentication: {
          methods: ['api_key', 'oauth2_authorization_code_pkce'],
          bearerHeader: 'Authorization: Bearer <credential>',
          protectedResourceMetadata: `${url.origin}/.well-known/oauth-protected-resource/api/mcp`,
        },
        apiDiscovery: `${url.origin}/api/v1`,
        documentation:
          'https://airtrail.johan.ohly.dk/docs/api/model-context-protocol',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
          Vary: 'Accept',
        },
      },
    );
  }

  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;
  return methodNotAllowed();
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  const originError = forbiddenOrigin(request, url.origin);
  if (originError) return originError;

  const principal = await authenticateMcpRequest(request, url.origin);
  if (principal instanceof Response) return principal;
  return methodNotAllowed();
};

export const OPTIONS: RequestHandler = async ({ request, url }) => {
  const originError = forbiddenOrigin(request, url.origin);
  if (originError) return originError;
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Origin': url.origin,
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
};
