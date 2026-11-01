import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_FLIGHTS_PER_PAGE,
  FLIGHTS_PER_PAGE_KEY,
  PAGE_SIZE_OPTIONS,
  readFlightsPerPage,
  writeFlightsPerPage,
} from './page-size-storage';

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

describe('flights per page preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to 20 flights per page when nothing is stored', () => {
    vi.stubGlobal('localStorage', memoryStorage());

    expect(readFlightsPerPage()).toBe(DEFAULT_FLIGHTS_PER_PAGE);
  });

  it('reads back the stored choice', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);

    writeFlightsPerPage(50);
    expect(storage.getItem(FLIGHTS_PER_PAGE_KEY)).toBe('50');
    expect(readFlightsPerPage()).toBe(50);

    writeFlightsPerPage(10);
    expect(readFlightsPerPage()).toBe(10);
  });

  it('falls back to the default for invalid stored values', () => {
    for (const invalid of ['15', 'abc', '20.5', null]) {
      const storage = memoryStorage();
      if (invalid !== null) storage.setItem(FLIGHTS_PER_PAGE_KEY, invalid);
      vi.stubGlobal('localStorage', storage);

      expect(readFlightsPerPage()).toBe(DEFAULT_FLIGHTS_PER_PAGE);
    }
  });

  it('falls back to the default when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());

    expect(readFlightsPerPage()).toBe(DEFAULT_FLIGHTS_PER_PAGE);
    expect(() => writeFlightsPerPage(50)).not.toThrow();
  });

  it('exposes the default among the selectable options', () => {
    expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_FLIGHTS_PER_PAGE);
  });
});
