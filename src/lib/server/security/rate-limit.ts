/*
 * In-process, fixed-window rate limiting.
 *
 * There is no scheduler or shared cache in this codebase, so windows live in a
 * per-process Map. That covers the endpoints this guards: all four are
 * unauthenticated, and each either does deliberately expensive work (the argon2
 * verification in the login handler) or writes a row on every request
 * (/oauth/register and /oauth/authorize). It is explicitly per-process though:
 * each instance behind a load balancer counts separately, and a restart clears
 * every window. If AirTrail is ever run with more than one replica, move the
 * store to Postgres or Redis behind `createRateLimiter`'s interface.
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
 * `getClientAddress` throws when ADDRESS_HEADER names a header the request does
 * not carry, which happens if the app is deployed without the reverse proxy it
 * is configured for. Fall back to one shared bucket: over-limiting every caller
 * is the safe direction to fail in.
 */
export const clientIdentity = (getClientAddress: () => string): string => {
  try {
    return getClientAddress() || 'unknown';
  } catch {
    return 'unknown';
  }
};
