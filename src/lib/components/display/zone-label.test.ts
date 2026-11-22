import { describe, expect, it } from 'vitest';

import { offsetLabel, zoneLabel } from './zone-label';

const summer = new Date('2026-08-14T11:15:00Z');
const winter = new Date('2026-01-14T11:15:00Z');

describe('offsetLabel', () => {
  it('names a zone by its offset at that moment', () => {
    expect(offsetLabel('Europe/Madrid', summer)).toBe('GMT+2');
    expect(offsetLabel('Europe/Madrid', winter)).toBe('GMT+1');
  });

  it('falls back to the zone name when it is unknown', () => {
    expect(offsetLabel('Not/AZone', summer)).toBe('Not/AZone');
  });
});

describe('zoneLabel', () => {
  const airport = { tz: 'Europe/Dublin', label: 'DUB' };

  it('uses the airport code for the airport zone', () => {
    expect(zoneLabel('Europe/Dublin', summer, airport)).toBe('DUB');
  });

  it('uses the offset for an airport without a code', () => {
    expect(
      zoneLabel('Europe/Dublin', summer, { tz: 'Europe/Dublin', label: null }),
    ).toBe('GMT+1');
  });

  it('uses the offset for another zone', () => {
    expect(zoneLabel('Europe/Madrid', summer, airport)).toBe('GMT+2');
  });

  it('calls UTC UTC rather than GMT', () => {
    expect(zoneLabel('UTC', summer, airport)).toBe('UTC');
  });
});
