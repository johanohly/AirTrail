import { describe, expect, it } from 'vitest';

import type { Airport } from '$lib/db/types';

import {
  preferRouteMatches,
  type FlightLookupResultItem,
} from './flight-lookup';

const airport = (icao: string, iata: string | null): Airport => ({
  id: 1,
  icao,
  iata,
  lat: 0,
  lon: 0,
  tz: 'UTC',
  name: icao,
  municipality: null,
  type: 'large_airport',
  continent: 'EU',
  country: 'DK',
  custom: false,
});

const flight = (from: Airport, to: Airport): FlightLookupResultItem => ({
  from,
  to,
});

const cph = airport('EKCH', 'CPH');
const lhr = airport('EGLL', 'LHR');
const jfk = airport('KJFK', 'JFK');
const outbound = flight(cph, lhr);
const returnLeg = flight(lhr, cph);
const connection = flight(cph, jfk);
const results = [outbound, returnLeg, connection];

describe('preferRouteMatches', () => {
  it('preserves results when no route is preferred', () => {
    expect(preferRouteMatches(results)).toBe(results);
    expect(preferRouteMatches(results, {})).toBe(results);
  });

  it('matches an origin independently and ignores code casing and whitespace', () => {
    expect(preferRouteMatches(results, { from: ' ekch ' })).toEqual([
      outbound,
      connection,
    ]);
  });

  it('matches a destination independently by IATA code', () => {
    expect(preferRouteMatches(results, { to: 'lhr' })).toEqual([outbound]);
  });

  it('requires both preferred endpoints to match the same flight', () => {
    expect(preferRouteMatches(results, { from: 'CPH', to: 'LHR' })).toEqual([
      outbound,
    ]);
  });

  it('preserves all results when the preferred route has no match', () => {
    expect(preferRouteMatches(results, { from: 'JFK', to: 'CPH' })).toBe(
      results,
    );
  });
});
