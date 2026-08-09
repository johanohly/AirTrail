import { describe, expect, it } from 'vitest';

import { buildFlightIndicators } from './flight-indicators';

import type { Airport, Flight } from '$lib/db/types';
import { prepareFlightData } from '$lib/utils';

const airport = (id: number): Airport =>
  ({ id, tz: 'UTC', lon: 0, lat: 0 }) as Airport;

const CDG = airport(1);
const JFK = airport(2);

const flight = (overrides: Partial<Flight> = {}) =>
  prepareFlightData([
    {
      id: 1,
      from: CDG,
      to: JFK,
      date: '2026-03-12',
      datePrecision: 'day',
      departure: null,
      arrival: null,
      duration: null,
      departureScheduled: null,
      arrivalScheduled: null,
      takeoffScheduled: null,
      takeoffActual: null,
      landingScheduled: null,
      landingActual: null,
      note: null,
      ...overrides,
    } as Flight,
  ])[0]!;

const keys = (...args: Parameters<typeof buildFlightIndicators>) =>
  buildFlightIndicators(...args).map((indicator) => indicator.key);

const labelFor = (
  key: string,
  ...args: Parameters<typeof buildFlightIndicators>
) => buildFlightIndicators(...args).find((i) => i.key === key)?.label;

describe('buildFlightIndicators', () => {
  it('returns nothing for a flight with only a date', () => {
    expect(keys(flight())).toEqual([]);
  });

  it('flags a recorded track only when the flight has one', () => {
    expect(keys(flight(), { hasTrack: true })).toEqual(['track']);
    expect(keys(flight(), { hasTrack: false })).toEqual([]);
  });

  it('ignores scheduled-only times', () => {
    const scheduled = flight({
      departureScheduled: '2026-03-12T10:00:00.000Z',
      arrivalScheduled: '2026-03-12T18:00:00.000Z',
    });
    expect(keys(scheduled)).toEqual([]);
  });

  it('describes which actual times are recorded', () => {
    expect(
      labelFor(
        'actualTimes',
        flight({ departure: '2026-03-12T10:04:00.000Z' }),
      ),
    ).toBe('Actual departure time recorded');
    expect(
      labelFor(
        'actualTimes',
        flight({ landingActual: '2026-03-12T18:12:00.000Z' }),
      ),
    ).toBe('Actual arrival time recorded');
    expect(
      labelFor(
        'actualTimes',
        flight({
          departure: '2026-03-12T10:04:00.000Z',
          arrival: '2026-03-12T18:12:00.000Z',
        }),
      ),
    ).toBe('Actual departure and arrival times recorded');
  });

  it('previews the note and truncates long ones', () => {
    expect(labelFor('note', flight({ note: '  Upgraded to J  ' }))).toBe(
      'Note: Upgraded to J',
    );
    expect(labelFor('note', flight({ note: '   ' }))).toBeUndefined();

    const long = 'a'.repeat(200);
    const label = labelFor('note', flight({ note: long }))!;
    expect(label).toBe(`Note: ${'a'.repeat(160)}…`);
  });

  it('keeps a stable order across all indicators', () => {
    const full = flight({
      departure: '2026-03-12T10:04:00.000Z',
      note: 'Window seat',
    });
    expect(keys(full, { hasTrack: true })).toEqual([
      'track',
      'actualTimes',
      'note',
    ]);
  });
});
