import { describe, expect, it, vi } from 'vitest';

import { createLookupCache } from './lookup-cache';

describe('createLookupCache', () => {
  it('evicts the least recently written entry past the cap', () => {
    const cache = createLookupCache<number>(2);
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.set('a', 3, 1000);
    cache.set('c', 4, 1000);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.value).toBe(3);
    expect(cache.get('c')?.value).toBe(4);
  });

  it('keeps expired entries until told to delete them', () => {
    vi.useFakeTimers();
    try {
      const cache = createLookupCache<number>(2);
      cache.set('a', 1, 1000);
      cache.set('b', 2, 2000);
      vi.advanceTimersByTime(1000);

      expect(cache.get('a')?.value).toBe(1);

      cache.deleteExpired();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')?.value).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares one request between concurrent callers and forgets it after', async () => {
    const cache = createLookupCache<number>(2);
    const load = vi.fn(async () => 1);

    await Promise.all([cache.dedupe('a', load), cache.dedupe('a', load)]);
    expect(load).toHaveBeenCalledTimes(1);

    await cache.dedupe('a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgets a failed request', async () => {
    const cache = createLookupCache<number>(2);
    const load = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(1);

    await expect(cache.dedupe('a', load)).rejects.toThrow('boom');
    await expect(cache.dedupe('a', load)).resolves.toBe(1);
  });
});
