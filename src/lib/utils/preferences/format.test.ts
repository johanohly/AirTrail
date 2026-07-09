import { describe, expect, it } from 'vitest';

import { altitudeUnitLabel, convertAltitude } from './format';

describe('altitude preferences', () => {
  it('uses metres with metric distance preferences', () => {
    const prefs = { distanceUnit: 'km' } as const;

    expect(convertAltitude(10_000, prefs)).toBeCloseTo(3_048);
    expect(altitudeUnitLabel(prefs)).toBe('m');
  });

  it.each(['mi', 'nm'] as const)(
    'uses feet with %s distance preferences',
    (distanceUnit) => {
      const prefs = { distanceUnit };

      expect(convertAltitude(10_000, prefs)).toBe(10_000);
      expect(altitudeUnitLabel(prefs)).toBe('ft');
    },
  );
});
