import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  clearTrackEventTimes,
  detectTrackEventTimes,
  prepareTrackEventTimes,
  resolveStoredTrackEventTimes,
  type StoredEventFlight,
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

/** Wall-clock date and time in the detected value's airport timezone. */
const local = (date: Date | null) =>
  date ? format(date, 'yyyy-MM-dd HH:mm') : null;

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
  it('detects both sides regardless of existing values', () => {
    const { detected } = prepareTrackEventTimes(track([0, 10, 0], [0, 1, 2]), {
      ...form,
      takeoffActual: '1970-01-01T00:00:00.000Z',
      takeoffActualTime: '12:00',
    });
    expect(local(detected.takeoffActual)).toBe('1970-01-01 00:00');
    expect(local(detected.landingActual)).toBe('1970-01-01 08:00');
  });
  it('rounds detected times down to the minute', () => {
    const { detected } = prepareTrackEventTimes(
      track([0, 10, 0], [100, 159, 219]),
      form,
    );
    expect(detected.takeoffActual?.getTime()).toBe(120_000);
    expect(detected.landingActual?.getTime()).toBe(180_000);
  });
  it('fills nothing when either side is over 24 hours from the schedule', () => {
    const result = prepareTrackEventTimes(track([0, 10], [90000, 90001]), form);
    expect(result.detected).toEqual({
      takeoffActual: null,
      landingActual: null,
    });
    expect(result.warnings).toHaveLength(1);
  });
  it('does not fill times on partial-date flights', () => {
    const { detected } = prepareTrackEventTimes(track([0, 10, 0], [0, 1, 2]), {
      ...form,
      datePrecision: 'month',
    });
    expect(detected).toEqual({ takeoffActual: null, landingActual: null });
  });
  it('allows exactly 24 hours and converts arrival to the airport day', () => {
    const result = prepareTrackEventTimes(
      track([0, 10, 0], [86397, 86400, 86403]),
      form,
    );
    expect(result.warnings).toEqual([]);
    expect(local(result.detected.takeoffActual)).toBe('1970-01-02 00:00');
    expect(local(result.detected.landingActual)).toBe('1970-01-02 08:00');
  });
  it('validates track endpoints when event detection is unavailable', () => {
    expect(
      prepareTrackEventTimes(track([10, 20], [90000, 90010]), form).warnings,
    ).toHaveLength(1);
  });
  it('detects times in the airport timezone', () => {
    const { detected } = prepareTrackEventTimes(
      track([0, 10], [46800, 46803]),
      { ...form, departureScheduled: null, departureScheduledTime: null },
    );
    expect(local(detected.takeoffActual)).toBe('1970-01-01 13:00');
    expect(detected.takeoffActual?.timeZone).toBe('UTC');
  });
  it('skips only the side whose airport is missing', () => {
    const input = track([0, 10, 0], [0, 1, 2]);
    const withoutDeparture = prepareTrackEventTimes(input, {
      ...form,
      from: null,
    } as unknown as FlightFormData);
    expect(withoutDeparture.detected.takeoffActual).toBeNull();
    expect(local(withoutDeparture.detected.landingActual)).toBe(
      '1970-01-01 08:00',
    );
    const withoutArrival = prepareTrackEventTimes(input, {
      ...form,
      to: null,
    } as unknown as FlightFormData);
    expect(local(withoutArrival.detected.takeoffActual)).toBe(
      '1970-01-01 00:00',
    );
    expect(withoutArrival.detected.landingActual).toBeNull();
  });
  it('clears only the values a track filled', () => {
    const values = {
      takeoffActual: '1970-01-01T00:00:00.000Z',
      takeoffActualTime: '00:00',
      landingActual: '1970-01-01T00:00:00.000Z',
      landingActualTime: '08:00',
    };
    const populated = { ...form, ...values };
    const cleared = {
      ...populated,
      ...clearTrackEventTimes(populated, values),
    };
    expect(cleared.takeoffActual).toBeNull();
    expect(cleared.takeoffActualTime).toBeNull();
    expect(cleared.landingActual).toBeNull();
    expect(cleared.landingActualTime).toBeNull();
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

describe('stored flight track times', () => {
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
  } satisfies StoredEventFlight;
  /** UTC ISO string as stored, or the reason nothing was detected. */
  const iso = (result: ReturnType<typeof resolveStoredTrackEventTimes>) => {
    const side = ({ at, reason }: typeof result.takeoffActual) =>
      at ? new Date(at.getTime()).toISOString() : reason;
    return {
      takeoff: side(result.takeoffActual),
      landing: side(result.landingActual),
    };
  };

  it('detects both sides rounded down to the minute', () => {
    expect(iso(resolveStoredTrackEventTimes(stored, flight))).toEqual({
      takeoff: '1970-01-01T07:00:00.000Z',
      landing: '1970-01-01T08:59:00.000Z',
    });
  });
  it('gives the same times as the flight form for the same track', () => {
    const { detected } = prepareTrackEventTimes(stored, {
      ...form,
      departureScheduled: '1970-01-01T00:00:00.000Z',
      departureScheduledTime: '07:00',
    });
    const result = resolveStoredTrackEventTimes(stored, flight);
    expect(result.takeoffActual.at?.getTime()).toBe(
      detected.takeoffActual?.getTime(),
    );
    expect(result.landingActual.at?.getTime()).toBe(
      detected.landingActual?.getTime(),
    );
    expect(result.landingActual.at?.timeZone).toBe('Asia/Hong_Kong');
  });
  it('detects regardless of a stored takeoff or landing', () => {
    expect(
      iso(
        resolveStoredTrackEventTimes(stored, {
          ...flight,
          takeoffActual: '1970-01-01T07:05:00.000Z',
        }),
      ).takeoff,
    ).toBe('1970-01-01T07:00:00.000Z');
  });
  it('detects nothing on partial-date flights, ignoring their stored day', () => {
    expect(
      iso(
        resolveStoredTrackEventTimes(stored, {
          ...flight,
          datePrecision: 'month',
          departure: '1970-03-01T00:00:00.000Z',
        }),
      ),
    ).toEqual({ takeoff: 'inexact-date', landing: 'inexact-date' });
  });
  it('detects nothing when either side is over 24 hours from the flight', () => {
    const result = resolveStoredTrackEventTimes(stored, {
      ...flight,
      arrival: '1970-01-03T09:05:00.000Z',
    });
    expect(iso(result)).toEqual({ takeoff: 'mismatch', landing: 'mismatch' });
    expect(result.mismatches).toEqual([
      { side: 'arrival', reference: 'the entered time' },
    ]);
  });
  it('detects a side without flight times to compare against', () => {
    expect(
      iso(
        resolveStoredTrackEventTimes(stored, {
          ...flight,
          departureScheduled: null,
          arrival: null,
        }),
      ),
    ).toEqual({
      takeoff: '1970-01-01T07:00:00.000Z',
      landing: '1970-01-01T08:59:00.000Z',
    });
  });
  it('skips a side without an airport', () => {
    expect(
      iso(resolveStoredTrackEventTimes(stored, { ...flight, to: null })),
    ).toEqual({ takeoff: '1970-01-01T07:00:00.000Z', landing: 'no-airport' });
  });
  it('says when the track starts or ends in the air', () => {
    expect(
      iso(
        resolveStoredTrackEventTimes(
          track([10, 10, 0], [25170, 25230, 25260]),
          flight,
        ),
      ),
    ).toEqual({ takeoff: 'in-air', landing: '1970-01-01T07:01:00.000Z' });
    expect(
      iso(resolveStoredTrackEventTimes(track([0, 10], [25170, 25230]), flight))
        .landing,
    ).toBe('in-air');
  });
  it('tells a missing transition apart from a track without timestamps', () => {
    expect(
      iso(resolveStoredTrackEventTimes(track([0, 10], [25170, 25300]), flight))
        .takeoff,
    ).toBe('not-detected');
    expect(
      iso(
        resolveStoredTrackEventTimes(
          {
            coordinates: [
              [0, 0, 0],
              [0, 0, 10],
            ],
          },
          flight,
        ),
      ),
    ).toEqual({ takeoff: 'no-times', landing: 'no-times' });
  });
});
