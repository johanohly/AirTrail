import { describe, expect, it } from 'vitest';

import type { Flight } from '$lib/db/types';
import { getAirportVisitSummary } from './airport-visits';
import { prepareFlightData } from './data';

const baseFlight = (): Flight =>
  ({
    from: { id: 1, tz: 'America/Los_Angeles', lon: -118, lat: 34 },
    to: { id: 2, tz: 'America/New_York', lon: -74, lat: 40 },
    date: '2024-06-14',
    datePrecision: 'day',
    duration: 14_400,
    departure: null,
    arrival: null,
    departureScheduled: null,
    arrivalScheduled: null,
    takeoffScheduled: null,
    takeoffActual: null,
    landingScheduled: null,
    landingActual: null,
  }) as Flight;

const prepare = (flight: Flight) => prepareFlightData([flight])[0]!;

describe('airport visit summary', () => {
  it('uses day precision for an exact timestamp on a coarse flight date', () => {
    const flight = {
      ...baseFlight(),
      datePrecision: 'month',
      arrivalScheduled: '2024-06-14T09:45:00.000Z',
    } as Flight;

    expect(
      getAirportVisitSummary(
        [prepare(flight)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ).last,
    ).toContain('14');
  });

  it('derives an untimed arrival from departure and duration', () => {
    const flight = {
      ...baseFlight(),
      departureScheduled: '2024-06-15T06:00:00.000Z',
    } as Flight;

    expect(
      getAirportVisitSummary(
        [prepare(flight)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ).last,
    ).toContain('15');
  });

  it('omits an arrival that cannot be placed on a calendar day', () => {
    const flight = { ...baseFlight(), duration: null };

    expect(
      getAirportVisitSummary(
        [prepare(flight)],
        2,
        new Date('2024-07-01T00:00:00Z'),
      ),
    ).toEqual({ last: null, next: null });
  });

  it('does not classify an imprecise range that contains now', () => {
    expect(
      getAirportVisitSummary(
        [prepare(baseFlight())],
        1,
        new Date('2024-06-14T12:00:00Z'),
      ),
    ).toEqual({ last: null, next: null });
  });
});
