import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  clientIdentity,
  createRateLimiter,
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
   * such header. A limiter that propagated that would turn a proxy
   * misconfiguration into a 500 on the login and token endpoints.
   */
  it('falls back to a shared bucket instead of throwing', () => {
    expect(
      clientIdentity(() => {
        throw new Error('Address header was specified but is absent');
      }),
    ).toBe('unknown');
    expect(clientIdentity(() => '')).toBe('unknown');
  });
});

/*
 * The endpoints deliberately guarded, because each is unauthenticated and
 * either does expensive work or writes a row per request. Scanned from source
 * so a rewrite that drops the check fails here rather than in production.
 */
const GUARDED_ROUTES = [
  'src/routes/oauth/token/+server.ts',
  'src/routes/oauth/register/+server.ts',
  'src/routes/oauth/authorize/+server.ts',
  'src/routes/api/users/login/+server.ts',
];

describe('guarded endpoints', () => {
  it.each(GUARDED_ROUTES)('%s checks a rate limit', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source).toContain('rateLimiter.check');
  });
});
