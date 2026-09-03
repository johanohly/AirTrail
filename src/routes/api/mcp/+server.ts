import type { RequestHandler } from './$types';
import { authenticateApiPrincipal } from '$lib/server/api/v1/principal';
import { apiV1Unauthorized } from '$lib/server/api/v1/errors';
import { handleMcpRequest } from '$lib/server/mcp/server';

export const POST: RequestHandler = async ({ request, url }) => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin)
    return new Response('Forbidden origin', { status: 403 });
  const principal = await authenticateApiPrincipal(
    request,
    `${url.origin}/api/mcp`,
  );
  if (!principal) {
    const response = apiV1Unauthorized();
    response.headers.set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    return response;
  }
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

export const GET: RequestHandler = async () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
export const DELETE: RequestHandler = GET;
export const OPTIONS: RequestHandler = async ({ url }) =>
  new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Origin': url.origin,
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
