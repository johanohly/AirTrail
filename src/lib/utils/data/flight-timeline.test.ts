import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { isCompletedFlight } from './flight-timeline';
import type { Flight } from '$lib/db/types';

describe('completed flights', () => {
  const now = new TZDate(2026, 5, 15, 12, 0, 'UTC');
  const flight = (fields: Partial<Flight>) =>
    ({
      date: '2026-06-15',
      datePrecision: 'day',
      from: null,
      to: null,
      departure: null,
      arrival: null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      duration: null,
      ...fields,
    }) as Flight;

  it('counts a flight that has landed as completed', () => {
    expect(
      isCompletedFlight(flight({ arrival: '2026-06-15T11:00:00Z' }), now),
    ).toBe(true);
  });

  it('counts a flight that is still in the air as upcoming', () => {
    expect(
      isCompletedFlight(flight({ arrival: '2026-06-15T14:00:00Z' }), now),
    ).toBe(false);
  });

  it('uses the scheduled departure of a flight flying later today', () => {
    const tonight = flight({
      departureScheduled: '2026-06-15T18:00:00Z',
    });

    expect(isCompletedFlight(tonight, now)).toBe(false);
  });

  it('waits for the end of the month for a month-only flight', () => {
    const june = flight({ date: '2026-06-01', datePrecision: 'month' });

    expect(isCompletedFlight(june, now)).toBe(false);
  });

  it('waits for the end of the year for a year-only flight', () => {
    const thisYear = flight({ date: '2026-01-01', datePrecision: 'year' });
    const lastYear = flight({ date: '2025-01-01', datePrecision: 'year' });

    expect(isCompletedFlight(thisYear, now)).toBe(false);
    expect(isCompletedFlight(lastYear, now)).toBe(true);
  });
});
