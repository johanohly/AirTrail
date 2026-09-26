/*
 * Endpoints that authenticate from the request alone -- a bearer credential or
 * OAuth client credentials -- and never read cookies. Any origin may call
 * them: a cross-site page can present nothing a same-site one could not, and
 * browser-based MCP and OAuth clients necessarily run on another origin.
 */
const CORS_PATHS = [
  /^\/api\/v1(\/|$)/,
  /^\/api\/mcp$/,
  /^\/oauth\/(token|register|revoke)$/,
  /^\/\.well-known\/oauth-(authorization-server|protected-resource)(\/|$)/,
];

export const isCorsPath = (pathname: string) =>
  CORS_PATHS.some((pattern) => pattern.test(pathname));

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers':
    'WWW-Authenticate, Retry-After, Location, Content-Disposition',
} as const;

export const corsPreflight = () =>
  new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id',
      'Access-Control-Max-Age': '600',
    },
  });

export const withCorsHeaders = (response: Response) => {
  // Responses built by fetch or `redirect` can have immutable headers.
  const mutable = new Response(response.body, response);
  for (const [name, value] of Object.entries(CORS_HEADERS))
    mutable.headers.set(name, value);
  return mutable;
};
