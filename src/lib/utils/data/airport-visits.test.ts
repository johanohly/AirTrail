import { describe, expect, it } from 'vitest';

import {
  getAirportVisitSummary,
  type AirportVisitFlight,
} from './airport-visits';

const baseFlight = (): AirportVisitFlight => ({
  from: { id: 1, tz: 'America/Los_Angeles' },
  to: { id: 2, tz: 'America/New_York' },
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
  raw: { date: '2024-06-14' },
});

describe('airport visit summary', () => {
  it('uses day precision for an exact timestamp on a coarse flight date', () => {
    const flight = {
      ...baseFlight(),
      datePrecision: 'month',
      arrivalScheduled: '2024-06-14T09:45:00.000Z',
    } satisfies AirportVisitFlight;

    expect(
      getAirportVisitSummary([flight], 2, new Date('2024-07-01T00:00:00Z'))
        .last,
    ).toContain('14');
  });

  it('derives an untimed arrival from departure and duration', () => {
    const flight = {
      ...baseFlight(),
      departureScheduled: '2024-06-15T06:00:00.000Z',
    } satisfies AirportVisitFlight;

    expect(
      getAirportVisitSummary([flight], 2, new Date('2024-07-01T00:00:00Z'))
        .last,
    ).toContain('15');
  });

  it('omits an arrival that cannot be placed on a calendar day', () => {
    const flight = { ...baseFlight(), duration: null };

    expect(
      getAirportVisitSummary([flight], 2, new Date('2024-07-01T00:00:00Z')),
    ).toEqual({ last: null, next: null });
  });

  it('does not classify an imprecise range that contains now', () => {
    expect(
      getAirportVisitSummary(
        [baseFlight()],
        1,
        new Date('2024-06-14T12:00:00Z'),
      ),
    ).toEqual({ last: null, next: null });
  });
});
