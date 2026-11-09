import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import type { FlightData } from './data';
import { buildFlightSideTimes, timingStatusClass } from './flight-times';

import type { Flight } from '$lib/db/types';

type Fields = Partial<Omit<FlightData, 'raw'>> & { raw?: Partial<Flight> };

const flight = (fields: Fields = {}) =>
  ({
    from: { tz: 'UTC' },
    to: { tz: 'UTC' },
    departure: null,
    arrival: null,
    raw: {
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
    },
    ...fields,
  }) as FlightData;

describe('buildFlightSideTimes', () => {
  it('uses the recorded gate actual on its own', () => {
    const actual = new TZDate(2026, 5, 15, 12, 0, 'UTC');
    const times = buildFlightSideTimes(
      flight({ departure: actual }),
      'departure',
    );

    expect(times.at).toBe(actual);
    expect(times.isActual).toBe(true);
    expect(times.actual).toBe(actual);
    expect(times.scheduled).toBeNull();
    expect(times.timing.status).toBeNull();
  });

  it('falls back to the scheduled time without an actual, whatever the preference', () => {
    const f = flight({ raw: { departureScheduled: '2026-06-15T12:00Z' } });

    const defaultTimes = buildFlightSideTimes(f, 'departure');
    expect(defaultTimes.at?.getTime()).toBe(
      new Date('2026-06-15T12:00:00Z').getTime(),
    );
    expect(defaultTimes.isActual).toBe(false);

    const preferScheduled = buildFlightSideTimes(f, 'departure', true);
    expect(preferScheduled.at?.getTime()).toBe(defaultTimes.at?.getTime());
    expect(preferScheduled.isActual).toBe(false);
  });

  it('picks between actual and scheduled times by preference', () => {
    const actual = new TZDate(2026, 5, 15, 12, 20, 'UTC');
    const f = flight({
      departure: actual,
      raw: { departureScheduled: '2026-06-15T12:00Z' },
    });

    const actualTimes = buildFlightSideTimes(f, 'departure');
    expect(actualTimes.at).toBe(actual);
    expect(actualTimes.isActual).toBe(true);
    expect(actualTimes.scheduled?.getTime()).toBe(
      new Date('2026-06-15T12:00:00Z').getTime(),
    );
    expect(actualTimes.timing.status).toBe('late');

    const scheduledTimes = buildFlightSideTimes(f, 'departure', true);
    expect(scheduledTimes.at?.getTime()).toBe(actualTimes.scheduled?.getTime());
    expect(scheduledTimes.isActual).toBe(false);
  });

  it('shows nothing without any time', () => {
    const times = buildFlightSideTimes(flight(), 'departure');

    expect(times.at).toBeNull();
    expect(times.isActual).toBe(false);
    expect(times.timing.headline).toBeNull();
  });

  it('keeps the actual flag when the preference cannot be honoured', () => {
    const actual = new TZDate(2026, 5, 15, 12, 0, 'UTC');
    const times = buildFlightSideTimes(
      flight({ departure: actual }),
      'departure',
      true,
    );

    expect(times.at).toBe(actual);
    expect(times.isActual).toBe(true);
  });

  it('infers a departure status from a takeoff before the gate schedule', () => {
    const times = buildFlightSideTimes(
      flight({
        raw: {
          departureScheduled: '2026-06-15T12:00Z',
          takeoffActual: '2026-06-15T11:40Z',
        },
      }),
      'departure',
    );

    expect(times.timing.status).toBe('early');
  });

  it('stays neutral when a takeoff after the gate schedule could still be on time', () => {
    const times = buildFlightSideTimes(
      flight({
        raw: {
          departureScheduled: '2026-06-15T12:00Z',
          takeoffActual: '2026-06-15T12:10Z',
        },
      }),
      'departure',
    );

    expect(times.timing.status).toBeNull();
  });

  it('infers an arrival status from a landing after the gate schedule', () => {
    const times = buildFlightSideTimes(
      flight({
        raw: {
          arrivalScheduled: '2026-06-15T12:00Z',
          landingActual: '2026-06-15T12:10Z',
        },
      }),
      'arrival',
    );

    expect(times.timing.status).toBe('late');
  });

  it('parses nothing without an airport', () => {
    const times = buildFlightSideTimes(
      flight({
        from: null,
        to: null,
        raw: {
          departureScheduled: '2026-06-15T12:00Z',
          arrivalScheduled: '2026-06-15T14:00Z',
        },
      }),
      'departure',
    );

    expect(times.scheduled).toBeNull();
    expect(times.at).toBeNull();
    expect(times.isActual).toBe(false);
  });
});

describe('timingStatusClass', () => {
  it('colors early and late times', () => {
    expect(timingStatusClass('early')).toEqual({
      'text-green-600 dark:text-green-400': true,
      'text-red-600 dark:text-red-400': false,
    });
    expect(timingStatusClass('late')).toEqual({
      'text-green-600 dark:text-green-400': false,
      'text-red-600 dark:text-red-400': true,
    });
    expect(timingStatusClass(null)).toEqual({
      'text-green-600 dark:text-green-400': false,
      'text-red-600 dark:text-red-400': false,
    });
  });
});
