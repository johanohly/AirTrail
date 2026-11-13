import { describe, expect, it } from 'vitest';

import {
  clearTrackEventTimes,
  detectTrackEventTimes,
  fillTrackEventTimes,
  prepareTrackEventTimes,
} from './event-times';
import type { FlightTrackInput } from './schema';
import type { FlightFormData } from '$lib/zod/flight';

const track = (
  altitudes: (number | undefined)[],
  times: number[],
): FlightTrackInput => ({
  sourceFormat: 'kml',
  sourceName: null,
  coordinates: altitudes.map((alt) =>
    alt === undefined ? [0, 0] : [0, 0, alt],
  ),
  times,
});
const form = {
  datePrecision: 'day',
  from: { tz: 'UTC' },
  to: { tz: 'Asia/Hong_Kong' },
  departureScheduled: '1970-01-01T00:00:00.000Z',
  departureScheduledTime: '00:00',
  arrivalScheduled: null,
  arrivalScheduledTime: null,
} as FlightFormData;

describe('track event times', () => {
  it('uses the confirming report at the sixty-second boundary', () => {
    expect(
      detectTrackEventTimes(track([0, 10, 20, 0], [0, 60, 90, 150])),
    ).toEqual({
      takeoff: 60,
      landing: 150,
    });
  });
  it('rejects missing altitude, negative altitude, long gaps and duplicate timestamps', () => {
    for (const [altitudes, times] of [
      [
        [undefined, 10],
        [0, 1],
      ],
      [
        [-1, 10],
        [0, 1],
      ],
      [
        [0, 10],
        [0, 61],
      ],
      [
        [0, 10],
        [1, 1],
      ],
    ] as [(number | undefined)[], number[]][]) {
      expect(detectTrackEventTimes(track(altitudes, times))).toEqual({
        takeoff: null,
        landing: null,
      });
    }
  });
  it('accepts a seven-second takeoff gap without ground flags', () => {
    expect(detectTrackEventTimes(track([0, 10], [0, 7]))).toEqual({
      takeoff: 7,
      landing: null,
    });
  });
  it('prefers ground flags even when altitude is missing or contradicts them', () => {
    expect(
      detectTrackEventTimes({
        ...track([undefined, 0, 100], [0, 30, 60]),
        ground: [true, false, true],
      }),
    ).toEqual({ takeoff: 30, landing: 60 });
  });
  it('does not fall back to altitude when ground flags are present', () => {
    expect(
      detectTrackEventTimes({
        ...track([0, 10, 0], [0, 7, 14]),
        ground: [false, false, false],
      }),
    ).toEqual({ takeoff: null, landing: null });
  });
  it('applies the sixty-second limit to ground-flag transitions too', () => {
    expect(
      detectTrackEventTimes({
        ...track([undefined, undefined], [0, 60]),
        ground: [true, false],
      }),
    ).toEqual({ takeoff: 60, landing: null });
    expect(
      detectTrackEventTimes({
        ...track([undefined, undefined], [0, 61]),
        ground: [false, true],
      }),
    ).toEqual({ takeoff: null, landing: null });
  });
  it('keeps the first takeoff but omits landing when a circuit is unfinished', () => {
    expect(detectTrackEventTimes(track([0, 10, 0, 10], [0, 1, 2, 3]))).toEqual({
      takeoff: 1,
      landing: null,
    });
  });
  it('selects the first takeoff and final landing after multiple touch-and-goes', () => {
    expect(
      detectTrackEventTimes(
        track([0, 10, 0, 10, 0, 10, 0, 0], [0, 10, 20, 30, 40, 50, 60, 70]),
      ),
    ).toEqual({ takeoff: 10, landing: 60 });
  });
  it('handles touch-and-goes using ground flags rather than altitude', () => {
    expect(
      detectTrackEventTimes({
        ...track([100, 100, 100, 100, 100], [0, 10, 20, 30, 40]),
        ground: [true, false, true, false, true],
      }),
    ).toEqual({ takeoff: 10, landing: 40 });
  });
  it('does not reuse an earlier touchdown when later transitions exceed sixty seconds', () => {
    expect(
      detectTrackEventTimes(track([0, 10, 0, 10, 0], [0, 10, 20, 90, 160])),
    ).toEqual({ takeoff: 10, landing: null });
  });
  it('leaves landing empty when ground flags show flight continuing', () => {
    expect(
      detectTrackEventTimes({
        ...track([0, 0, 0, 0], [0, 10, 20, 90]),
        ground: [true, false, true, false],
      }),
    ).toEqual({ takeoff: 10, landing: null });
  });
  it('allows a go-around without ground contact before the final landing', () => {
    expect(
      detectTrackEventTimes(track([0, 100, 10, 100, 0], [0, 10, 20, 30, 40])),
    ).toEqual({ takeoff: 10, landing: 40 });
  });
  it('can detect landing when the initial takeoff is outside track coverage', () => {
    expect(detectTrackEventTimes(track([100, 0], [0, 10]))).toEqual({
      takeoff: null,
      landing: 10,
    });
  });
  it('ignores a touchdown and liftoff when the track starts and ends airborne', () => {
    expect(detectTrackEventTimes(track([100, 0, 100], [0, 10, 20]))).toEqual({
      takeoff: null,
      landing: null,
    });
  });
  it('does not take a touch-and-go liftoff for the takeoff when the first one has a gap', () => {
    expect(
      detectTrackEventTimes(track([0, 10, 0, 10, 0], [0, 90, 100, 110, 120])),
    ).toEqual({ takeoff: null, landing: 120 });
  });
  it('does not fill a side with a partially populated field', () => {
    const input = track([0, 10, 0], [0, 1, 2]);
    for (const field of ['takeoffActual', 'takeoffActualTime']) {
      const { values } = prepareTrackEventTimes(input, {
        ...form,
        [field]:
          field === 'takeoffActual' ? '1970-01-01T00:00:00.000Z' : '12:00',
      });
      expect(values.takeoffActual).toBeUndefined();
      expect(values.takeoffActualTime).toBeUndefined();
      expect(values.landingActualTime).toBe('08:00');
    }
  });
  it('fills nothing when either side is over 24 hours from the schedule', () => {
    const result = prepareTrackEventTimes(track([0, 10], [90000, 90001]), form);
    expect(result.values).toEqual({});
    expect(result.warnings).toHaveLength(1);
  });
  it('does not fill times on partial-date flights', () => {
    const { values } = prepareTrackEventTimes(track([0, 10, 0], [0, 1, 2]), {
      ...form,
      datePrecision: 'month',
    });
    expect(values).toEqual({});
  });
  it('allows exactly 24 hours and converts arrival to the airport day', () => {
    const result = prepareTrackEventTimes(
      track([0, 10, 0], [86397, 86400, 86403]),
      form,
    );
    expect(result.warnings).toEqual([]);
    expect(result.values.takeoffActualTime).toBe('00:00');
    expect(result.values.landingActualTime).toBe('08:00');
    expect(result.values.landingActual).toBe('1970-01-02T00:00:00.000Z');
  });
  it('validates track endpoints when event detection is unavailable', () => {
    expect(
      prepareTrackEventTimes(track([10, 20], [90000, 90010]), form).warnings,
    ).toHaveLength(1);
  });
  it('fills canonical 24-hour times the form validator accepts', () => {
    const { values } = prepareTrackEventTimes(track([0, 10], [46800, 46803]), {
      ...form,
      departureScheduled: null,
      departureScheduledTime: null,
    });
    expect(values.takeoffActualTime).toBe('13:00');
  });
  it('skips only the side whose airport is missing', () => {
    const input = track([0, 10, 0], [0, 1, 2]);
    const withoutDeparture = prepareTrackEventTimes(input, {
      ...form,
      from: null,
    } as unknown as FlightFormData);
    expect(withoutDeparture.values.takeoffActual).toBeUndefined();
    expect(withoutDeparture.values.landingActualTime).toBe('08:00');
    const withoutArrival = prepareTrackEventTimes(input, {
      ...form,
      to: null,
    } as unknown as FlightFormData);
    expect(withoutArrival.values.takeoffActualTime).toBe('00:00');
    expect(withoutArrival.values.landingActual).toBeUndefined();
  });
  it('clears old autofill so a replacement can populate new times', () => {
    const { values } = prepareTrackEventTimes(
      track([0, 10, 0], [0, 1, 2]),
      form,
    );
    const populated = { ...form, ...values };
    const cleared = {
      ...populated,
      ...clearTrackEventTimes(populated, values),
    };
    expect(cleared.takeoffActual).toBeNull();
    expect(cleared.takeoffActualTime).toBeNull();
    expect(cleared.landingActual).toBeNull();
    expect(cleared.landingActualTime).toBeNull();
    const replacement = prepareTrackEventTimes(
      track([0, 10, 0], [120, 121, 122]),
      cleared,
    );
    expect(replacement.values.takeoffActualTime).toBe('00:02');
    expect(replacement.values.landingActualTime).toBe('08:02');
  });
  it('preserves manual entries and edits when clearing track times', () => {
    const filled = {
      takeoffActual: '1970-01-01T00:00:00.000Z',
      takeoffActualTime: '00:00',
    };
    expect(clearTrackEventTimes({ ...form, ...filled }, {})).toEqual({});
    expect(
      clearTrackEventTimes(
        { ...form, ...filled, takeoffActualTime: '00:05' },
        filled,
      ),
    ).toEqual({});
  });
});

describe('track timing check', () => {
  const twoDaysLater = {
    ...form,
    departureScheduled: null,
    departureScheduledTime: null,
    departure: '1970-01-03T00:00:00.000Z',
    departureTime: '00:00',
    arrival: '1970-01-03T00:00:00.000Z',
    arrivalTime: '09:00',
  } as FlightFormData;
  const endpoints = track([undefined, undefined], [0, 3600]);

  it('compares against the entered times when there is no schedule', () => {
    expect(prepareTrackEventTimes(endpoints, twoDaysLater).warnings).toEqual([
      'Departure track time differs from the entered time by more than 24 hours. Check that this track belongs to this flight.',
      'Arrival track time differs from the entered time by more than 24 hours. Check that this track belongs to this flight.',
    ]);
  });

  it('prefers the schedule over the entered time on each side', () => {
    const { warnings } = prepareTrackEventTimes(endpoints, {
      ...twoDaysLater,
      departureScheduled: '1970-01-01T00:00:00.000Z',
      departureScheduledTime: '00:00',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^Arrival/);
  });

  it('falls back to runway times when no gate time is complete', () => {
    const { warnings } = prepareTrackEventTimes(endpoints, {
      ...twoDaysLater,
      departureTime: null,
      arrival: null,
      takeoffScheduled: '1970-01-03T00:00:00.000Z',
      takeoffScheduledTime: '00:00',
      landingActual: '1970-01-01T00:00:00.000Z',
      landingActualTime: '09:00',
    });
    expect(warnings).toEqual([
      'Departure track time differs from the original schedule by more than 24 hours. Check that this track belongs to this flight.',
    ]);
  });
});

describe('filling stored flight times from a track', () => {
  // Takeoff at 07:00:30 UTC, landing at 08:59:45 UTC.
  const stored = track([0, 10, 10, 0], [25170, 25230, 32370, 32385]);
  const flight = {
    datePrecision: 'day',
    from: { tz: 'UTC' },
    to: { tz: 'Asia/Hong_Kong' },
    departureScheduled: '1970-01-01T07:00:00.000Z',
    departure: null,
    takeoffScheduled: null,
    takeoffActual: null,
    arrivalScheduled: null,
    arrival: '1970-01-01T09:05:00.000Z',
    landingScheduled: null,
    landingActual: null,
  } as unknown as Parameters<typeof fillTrackEventTimes>[1];

  it('fills both sides as UTC ISO strings rounded down to the minute', () => {
    expect(fillTrackEventTimes(stored, flight)).toEqual({
      takeoffActual: '1970-01-01T07:00:00.000Z',
      landingActual: '1970-01-01T08:59:00.000Z',
    });
  });
  it('matches what the upload dialog fills for the same track', () => {
    const { values } = prepareTrackEventTimes(stored, form);
    expect(values.takeoffActualTime).toBe('07:00');
    // 08:59 UTC is 16:59 in Hong Kong.
    expect(values.landingActualTime).toBe('16:59');
  });
  it('keeps a side that already has a value', () => {
    expect(
      fillTrackEventTimes(stored, {
        ...flight,
        takeoffActual: '1970-01-01T07:05:00.000Z',
      }),
    ).toEqual({ landingActual: '1970-01-01T08:59:00.000Z' });
  });
  it('fills nothing on partial-date flights', () => {
    expect(
      fillTrackEventTimes(stored, { ...flight, datePrecision: 'month' }),
    ).toEqual({});
  });
  it('fills nothing when either side is over 24 hours from the flight', () => {
    expect(
      fillTrackEventTimes(stored, {
        ...flight,
        arrival: '1970-01-03T09:05:00.000Z',
      }),
    ).toEqual({});
  });
  it('fills a side without flight times to compare against', () => {
    expect(
      fillTrackEventTimes(stored, {
        ...flight,
        departureScheduled: null,
        arrival: null,
      }),
    ).toEqual({
      takeoffActual: '1970-01-01T07:00:00.000Z',
      landingActual: '1970-01-01T08:59:00.000Z',
    });
  });
  it('skips a side without an airport', () => {
    expect(fillTrackEventTimes(stored, { ...flight, to: null })).toEqual({
      takeoffActual: '1970-01-01T07:00:00.000Z',
    });
  });
  it('fills nothing when the track has no clear transition', () => {
    expect(
      fillTrackEventTimes(track([10, 10], [25230, 32370]), flight),
    ).toEqual({});
  });
});
