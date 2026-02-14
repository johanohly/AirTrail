/**
 * Sentinel object representing a cached "not found" result.
 * Used because LRUCache's value type constraint (V extends {}) disallows null.
 */
const NOT_FOUND = Symbol('NOT_FOUND');

type NotFound = { __brand: typeof NOT_FOUND };
export const notFound: NotFound = { __brand: NOT_FOUND };

export type CacheEntry<T> = T | NotFound;

export function unwrap<T>(entry: CacheEntry<T>): T | null {
  return entry === notFound ? null : (entry as T);
}
