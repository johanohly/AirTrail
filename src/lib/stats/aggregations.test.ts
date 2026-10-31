import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '$lib/data/countries';
import {
  countFlightsPerYear,
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

describe('flights per year statistics', () => {
  const flightOn = (date: TZDate | null) => ({ date }) as FlightData;
  // Date parts are read in the given zone, so the host zone can't move a
  // flight into another year
  const at = (
    year: number,
    month: number,
    day: number,
    hour = 12,
    zone = 'UTC',
  ) => new TZDate(year, month - 1, day, hour, 0, zone);

  it('counts flights per year and fills years without flights', () => {
    const flights = [
      flightOn(at(2021, 3, 1)),
      flightOn(at(2024, 7, 15)),
      flightOn(at(2021, 12, 31, 23)),
      flightOn(at(2023, 1, 1, 0)),
    ];

    expect(countFlightsPerYear(flights)).toEqual([
      { year: 2021, flights: 2 },
      { year: 2022, flights: 0 },
      { year: 2023, flights: 1 },
      { year: 2024, flights: 1 },
    ]);
  });

  it('uses the year in the flight date time zone', () => {
    const newYearsEveInLosAngeles = at(2019, 12, 31, 22, 'America/Los_Angeles');

    expect(countFlightsPerYear([flightOn(newYearsEveInLosAngeles)])).toEqual([
      { year: 2019, flights: 1 },
    ]);
  });

  it('skips flights without a date', () => {
    expect(
      countFlightsPerYear([flightOn(null), flightOn(at(2020, 5, 5))]),
    ).toEqual([{ year: 2020, flights: 1 }]);
  });

  it('returns no years when no flight has a date', () => {
    expect(countFlightsPerYear([flightOn(null)])).toEqual([]);
  });
});
