import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  countriesByContinentDetails,
  countriesByContinentDistribution,
} from './aggregations';

describe('country statistics', () => {
  const visitedKosovo = [
    { code: 'XK', status: 'visited', note: null },
  ] as const;

  it('counts Kosovo as a visited European country', () => {
    const result = countriesByContinentDistribution([...visitedKosovo]);
    const europeanCountries = COUNTRIES.filter(
      (country) => country.continent === 'Europe',
    );

    expect(result.Europe).toEqual({
      visited: 1,
      total: europeanCountries.length,
    });
  });

  it('includes Kosovo in country details', () => {
    const result = countriesByContinentDetails([...visitedKosovo]);
    const kosovo = result.Europe?.find((country) => country.code === 'XK');

    expect(kosovo).toMatchObject({
      name: 'Kosovo',
      visited: true,
    });
  });
});
