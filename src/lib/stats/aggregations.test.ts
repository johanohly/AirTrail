import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  countriesByContinentDetails,
  countriesByContinentDistribution,
  flightMatchesChartBucket,
  reasonDistribution,
} from './aggregations';
import type { FlightData } from '$lib/utils';

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

describe('passenger reason statistics', () => {
  const flights = [
    {
      passengers: [
        { userId: 'one', flightReason: 'business' },
        { userId: 'two', flightReason: 'leisure' },
      ],
    },
    {
      passengers: [
        { userId: 'one', flightReason: null },
        { userId: 'two', flightReason: 'leisure' },
      ],
    },
  ] as FlightData[];

  it('counts each passenger when aggregating all users', () => {
    expect(reasonDistribution(flights, {})).toMatchObject({
      Leisure: 2,
      Business: 1,
      'No Data': 1,
    });
  });

  it('counts only the selected passenger', () => {
    expect(reasonDistribution(flights, { userId: 'one' })).toMatchObject({
      Business: 1,
      'No Data': 1,
    });
    expect(
      flightMatchesChartBucket(flights[0]!, 'reason', 'Business', {
        userId: 'one',
      }),
    ).toBe(true);
    expect(
      flightMatchesChartBucket(flights[0]!, 'reason', 'Leisure', {
        userId: 'one',
      }),
    ).toBe(false);
  });
});
