import type { RequestEvent } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

/*
 * In-process, fixed-window rate limiting for the unauthenticated endpoints that
 * do expensive work (argon2 at login) or write a row per request (OAuth
 * registration and authorization). Windows live in a per-process Map, so each
 * replica counts separately and a restart clears them; a multi-replica
 * deployment would need a shared store behind `createRateLimiter`.
 */

export type RateLimitRule = {
  /** Identifies the counter; also lets one endpoint hold several rules. */
  name: string;
  /** Requests permitted per window, per identity. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  check: (rule: RateLimitRule, identity: string) => RateLimitResult;
  /** Tracked windows, for tests and diagnostics. */
  tracked: () => number;
};

type Window = { count: number; resetAt: number };

const DEFAULT_MAX_KEYS = 10_000;

export const createRateLimiter = (
  options: { maxKeys?: number; now?: () => number } = {},
): RateLimiter => {
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const now = options.now ?? Date.now;
  const windows = new Map<string, Window>();

  /*
   * Keeps a caller that rotates identities (a botnet, or a forged
   * X-Forwarded-For once ADDRESS_HEADER is trusted) from growing the map
   * without bound. Expired windows go first; if the map is still full of live
   * ones, the oldest insertions are dropped -- an attacker can degrade their
   * own limits by spraying keys, but cannot use memory to take the process down.
   */
  const makeRoom = (currentTime: number) => {
    if (windows.size < maxKeys) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= currentTime) windows.delete(key);
    }
    const target = Math.floor(maxKeys * 0.9);
    for (const key of windows.keys()) {
      if (windows.size <= target) break;
      windows.delete(key);
    }
  };

  const check = (rule: RateLimitRule, identity: string): RateLimitResult => {
    const currentTime = now();
    makeRoom(currentTime);

    const key = `${rule.name}:${identity}`;
    const window = windows.get(key);
    if (!window || window.resetAt <= currentTime) {
      windows.set(key, { count: 1, resetAt: currentTime + rule.windowMs });
      return { allowed: true, remaining: rule.limit - 1 };
    }

    window.count += 1;
    if (window.count > rule.limit)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.resetAt - currentTime) / 1000),
        ),
      };
    return { allowed: true, remaining: rule.limit - window.count };
  };

  return { check, tracked: () => windows.size };
};

export const rateLimiter = createRateLimiter();

/*
 * Limits are generous enough that no human reaches them and low enough to blunt
 * automated abuse. They are per identity, which for every endpoint below is a
 * client address, so a shared NAT is one identity -- hence the headroom.
 */
export const RATE_LIMITS = {
  /** Token issuance: refresh and code exchange. */
  oauthToken: { name: 'oauth:token', limit: 30, windowMs: 60_000 },
  /** Token revocation; a client revokes a handful of tokens at sign-out. */
  oauthRevoke: { name: 'oauth:revoke', limit: 30, windowMs: 60_000 },
  /** Dynamic client registration; legitimately rare. */
  oauthRegister: { name: 'oauth:register', limit: 10, windowMs: 60_000 },
  /** Authorization requests; a login round trip is several redirects. */
  oauthAuthorize: { name: 'oauth:authorize', limit: 60, windowMs: 60_000 },
  /** Login attempts per address, across all usernames. */
  loginAddress: { name: 'login:address', limit: 10, windowMs: 60_000 },
  /** Login attempts per address *and* username, so spraying is bounded too. */
  loginAccount: { name: 'login:account', limit: 5, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/*
 * The address comes from the socket unless the operator sets ADDRESS_HEADER
 * behind a reverse proxy. `getClientAddress` throws when that header is
 * configured but absent, meaning the request bypassed the proxy. Such a caller
 * could forge the header anyway, so the request is not limited rather than
 * pooled into one bucket every client would share.
 */
export const clientIdentity = (
  getClientAddress: () => string,
): string | null => {
  try {
    return getClientAddress() || null;
  } catch {
    return null;
  }
};

export const checkRateLimit = (
  event: Pick<RequestEvent, 'getClientAddress'>,
  rule: RateLimitRule,
  key?: string,
): RateLimitResult => {
  // The e2e suite signs in from one address far faster than any person would.
  if (env.DISABLE_RATE_LIMITS === 'true')
    return { allowed: true, remaining: rule.limit };
  const identity = clientIdentity(event.getClientAddress);
  if (identity === null) return { allowed: true, remaining: rule.limit };
  return rateLimiter.check(rule, key ? `${identity}:${key}` : identity);
};
