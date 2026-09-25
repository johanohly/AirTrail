import { describe, expect, it } from 'vitest';

import {
  checkRateLimit,
  clientIdentity,
  createRateLimiter,
  RATE_LIMITS,
  rateLimiter,
  type RateLimitRule,
} from './rate-limit';

const rule: RateLimitRule = { name: 'test', limit: 3, windowMs: 60_000 };

describe('fixed window', () => {
  it('allows up to the limit and reports the remaining budget', () => {
    const limiter = createRateLimiter();
    expect(limiter.check(rule, 'a')).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check(rule, 'a')).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check(rule, 'a')).toEqual({ allowed: true, remaining: 0 });
  });

  it('blocks the request past the limit and says when to retry', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < rule.limit; i += 1) limiter.check(rule, 'a');
    expect(limiter.check(rule, 'a')).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it('starts a fresh window once the old one expires', () => {
    let current = 0;
    const limiter = createRateLimiter({ now: () => current });
    for (let i = 0; i < rule.limit; i += 1) limiter.check(rule, 'a');
    expect(limiter.check(rule, 'a').allowed).toBe(false);

    current = rule.windowMs;
    expect(limiter.check(rule, 'a')).toEqual({ allowed: true, remaining: 2 });
  });

  it('counts each identity and each rule separately', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < rule.limit; i += 1) limiter.check(rule, 'a');

    expect(limiter.check(rule, 'b').allowed).toBe(true);
    expect(limiter.check({ ...rule, name: 'other' }, 'a').allowed).toBe(true);
  });
});

describe('memory guard', () => {
  it('does not track more keys than it is allowed to', () => {
    const limiter = createRateLimiter({ maxKeys: 10 });
    for (let i = 0; i < 200; i += 1) limiter.check(rule, `identity-${i}`);
    expect(limiter.tracked()).toBeLessThanOrEqual(10);
  });
});

describe('client identity', () => {
  it('uses the address SvelteKit reports', () => {
    expect(clientIdentity(() => '203.0.113.7')).toBe('203.0.113.7');
  });

  /*
   * `getClientAddress` throws when ADDRESS_HEADER is set but the request has no
   * such header. Pooling those requests would let one caller lock every user
   * out, so they are not limited at all.
   */
  it('reports no identity when the address is unavailable', () => {
    expect(
      clientIdentity(() => {
        throw new Error('Address header was specified but is absent');
      }),
    ).toBeNull();
    expect(clientIdentity(() => '')).toBeNull();
  });

  it('does not limit requests without an identity', () => {
    const event = {
      getClientAddress: () => {
        throw new Error('absent');
      },
    };
    for (let i = 0; i < 20; i += 1)
      expect(checkRateLimit(event, rule).allowed).toBe(true);
  });
});

/*
 * The unauthenticated endpoints that each do expensive work or write a row per
 * request. Each is called once its address has used up the rule, and must
 * answer before doing any of that work.
 */
describe('guarded endpoints', () => {
  const exhaust = (address: string, limit: RateLimitRule) => {
    for (let i = 0; i < limit.limit; i += 1) rateLimiter.check(limit, address);
  };
  const event = (address: string, request: Request) => ({
    request,
    url: new URL(request.url),
    getClientAddress: () => address,
    locals: {},
    cookies: { get: () => undefined, set: () => {}, delete: () => {} },
  });
  const form = (url: string) =>
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=someone&password=secret',
    });

  it.each([
    [
      'token',
      RATE_LIMITS.oauthToken,
      () => import('../../../routes/oauth/token/+server'),
      'POST',
    ],
    [
      'revoke',
      RATE_LIMITS.oauthRevoke,
      () => import('../../../routes/oauth/revoke/+server'),
      'POST',
    ],
    [
      'register',
      RATE_LIMITS.oauthRegister,
      () => import('../../../routes/oauth/register/+server'),
      'POST',
    ],
    [
      'authorize',
      RATE_LIMITS.oauthAuthorize,
      () => import('../../../routes/oauth/authorize/+server'),
      'GET',
    ],
  ] as const)('/oauth/%s answers 429', async (name, limit, load, method) => {
    const address = `198.51.100.${name.length}`;
    exhaust(address, limit);
    const handler = (await load())[method] as (
      event: unknown,
    ) => Promise<Response>;
    const url = `https://airtrail.example/oauth/${name}`;
    const response = await handler(
      event(address, method === 'GET' ? new Request(url) : form(url)),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
  });

  it('refuses a login attempt once the address is exhausted', async () => {
    const address = '198.51.100.200';
    exhaust(address, RATE_LIMITS.loginAddress);
    const { POST } = await import('../../../routes/api/users/login/+server');
    const response = await POST(
      event(address, form('https://airtrail.example/api/users/login')) as never,
    );
    expect(JSON.stringify(await response.json())).toContain(
      'Too many login attempts',
    );
  });
});
