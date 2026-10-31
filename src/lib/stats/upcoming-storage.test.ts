import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INCLUDE_UPCOMING_KEY,
  readIncludeUpcoming,
  writeIncludeUpcoming,
} from './upcoming-storage';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const throwingStorage = () => ({
  getItem: () => {
    throw new Error('storage unavailable');
  },
  setItem: () => {
    throw new Error('storage unavailable');
  },
});

describe('upcoming flights preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('excludes upcoming flights when nothing is stored', () => {
    vi.stubGlobal('localStorage', memoryStorage());

    expect(readIncludeUpcoming()).toBe(false);
  });

  it('reads back the stored choice', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);

    writeIncludeUpcoming(true);
    expect(storage.getItem(INCLUDE_UPCOMING_KEY)).toBe('true');
    expect(readIncludeUpcoming()).toBe(true);

    writeIncludeUpcoming(false);
    expect(readIncludeUpcoming()).toBe(false);
  });

  it('falls back to excluding when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());

    expect(readIncludeUpcoming()).toBe(false);
    expect(() => writeIncludeUpcoming(true)).not.toThrow();
  });
});
