/*
 * In-process cache for lookups against third-party APIs. Concurrent callers for
 * a key share one request, and the entry cap bounds memory when an authenticated
 * user enumerates keys. Expired entries stay readable so a caller can fall back
 * to them; checking `expiresAt` is up to the caller.
 */
export type LookupCacheEntry<V> = {
  value: V;
  fetchedAt: number;
  expiresAt: number;
};

export const createLookupCache = <V>(maxEntries: number) => {
  const entries = new Map<string, LookupCacheEntry<V>>();
  const inflight = new Map<string, Promise<unknown>>();

  return {
    get: (key: string) => entries.get(key),
    set: (key: string, value: V, ttlMs: number) => {
      const now = Date.now();
      // Deleting first moves the key to the end of the eviction order.
      entries.delete(key);
      entries.set(key, { value, fetchedAt: now, expiresAt: now + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    dedupe: <R>(key: string, load: () => Promise<R>): Promise<R> => {
      const existing = inflight.get(key);
      if (existing) return existing as Promise<R>;

      const promise = load().finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
  };
};
