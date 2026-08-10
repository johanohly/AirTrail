import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import { countryCodesFromFlights, countryFromAlpha2 } from './countries';

describe('country registry', () => {
  it('uses the EU country code for Kosovo', () => {
    expect(countryFromAlpha2('XK')).toMatchObject({
      name: 'Kosovo',
      alpha2: 'XK',
      alpha3: 'XKX',
      continent: 'Europe',
    });
  });

  it('uses the ISO country codes for Palestine', () => {
    expect(countryFromAlpha2('PS')).toMatchObject({
      name: 'Palestine',
      alpha2: 'PS',
      alpha3: 'PSE',
      continent: 'Asia',
    });
  });

  it('has unique country identifiers', () => {
    expect(new Set(COUNTRIES.map((country) => country.alpha2)).size).toBe(
      COUNTRIES.length,
    );
  });
});

describe('country codes from flights', () => {
  it('includes Kosovo and the other endpoint', () => {
    const codes = countryCodesFromFlights([
      { from: { country: 'DK' }, to: { country: 'XK' } },
    ]);

    expect([...codes]).toEqual(['DK', 'XK']);
  });

  it('keeps a known endpoint when the other country is unsupported', () => {
    const codes = countryCodesFromFlights([
      { from: { country: 'DK' }, to: { country: 'ZZ' } },
      { from: null, to: { country: 'XK' } },
    ]);

    expect([...codes]).toEqual(['DK', 'XK']);
  });
});
