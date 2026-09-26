import { describe, expect, it } from 'vitest';

import { corsPreflight, isCorsPath, withCorsHeaders } from './cors';

describe('cors paths', () => {
  it.each([
    '/api/v1',
    '/api/v1/flights/1',
    '/api/mcp',
    '/oauth/token',
    '/oauth/register',
    '/oauth/revoke',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource/api/mcp',
  ])('opens %s', (path) => {
    expect(isCorsPath(path)).toBe(true);
  });

  // These read the session cookie, so another origin must not call them.
  it.each([
    '/oauth/authorize',
    '/oauth/consent',
    '/api/flight/save/form',
    '/api/v1x',
    '/api/users/login',
  ])('keeps %s same-origin', (path) => {
    expect(isCorsPath(path)).toBe(false);
  });
});

describe('cors headers', () => {
  it('answers a preflight for the MCP headers', () => {
    const response = corsPreflight();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'MCP-Protocol-Version',
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  /*
   * A browser client reads the 401 challenge to find where to authenticate, so
   * the actual response -- not only the preflight -- must be readable.
   */
  it('exposes the bearer challenge on the actual response', () => {
    const response = withCorsHeaders(
      new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer' },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain(
      'WWW-Authenticate',
    );
  });

  it('handles responses with immutable headers', () => {
    const response = withCorsHeaders(Response.redirect('https://a.example/'));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
