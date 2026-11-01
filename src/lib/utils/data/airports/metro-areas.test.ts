import { describe, expect, it } from 'vitest';

import { metroAreaForIcao, sameMetroArea } from './metro-areas';

import { METRO_AREAS } from '$lib/data/metro-areas';

describe('metro area registry', () => {
  it('maps every ICAO into at most one metro area', () => {
    const icaos = Object.values(METRO_AREAS).flatMap((area) => [...area.icaos]);

    expect(new Set(icaos).size).toBe(icaos.length);
  });

  it('uses IATA-style city codes and four-letter ICAOs', () => {
    for (const [code, area] of Object.entries(METRO_AREAS)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      for (const icao of area.icaos) {
        expect(icao).toMatch(/^[A-Z]{4}$/);
      }
    }
  });

  it('keeps entries and their airports sorted', () => {
    const codes = Object.keys(METRO_AREAS);

    expect(codes).toEqual([...codes].sort());
    for (const { icaos } of Object.values(METRO_AREAS)) {
      expect([...icaos]).toEqual([...icaos].sort());
    }
  });

  it('clusters at least two airports per metro area', () => {
    for (const { icaos } of Object.values(METRO_AREAS)) {
      expect(icaos.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('groups all six London airports together', () => {
    for (const icao of ['EGLC', 'EGGW', 'EGKK', 'EGLL', 'EGMC', 'EGSS']) {
      expect(metroAreaForIcao(icao)).toBe('LON');
    }
  });

  it('leaves Rhine-Ruhr unclustered', () => {
    expect(metroAreaForIcao('EDDL')).toBeNull();
    expect(metroAreaForIcao('EDDK')).toBeNull();
    expect(metroAreaForIcao('EDLW')).toBeNull();
  });
});

describe('sameMetroArea', () => {
  it('matches two airports of one metro area', () => {
    expect(sameMetroArea('EGLL', 'EGKK')).toBe(true);
  });

  it('rejects airports of different metro areas', () => {
    expect(sameMetroArea('EGLL', 'LFPG')).toBe(false);
  });

  it('rejects unknown ICAOs', () => {
    expect(sameMetroArea('EGLL', 'YSSY')).toBe(false);
    expect(sameMetroArea('ZZZZ', 'EGKK')).toBe(false);
  });

  it('rejects missing ICAOs', () => {
    expect(sameMetroArea('EGLL', null)).toBe(false);
    expect(sameMetroArea(undefined, 'EGKK')).toBe(false);
    expect(sameMetroArea(null, undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(sameMetroArea('egll', 'EGKK')).toBe(true);
    expect(metroAreaForIcao('egll')).toBe('LON');
  });
});
