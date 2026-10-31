import { describe, expect, it } from 'vitest';

import {
  clearTrackEventTimes,
  detectTrackEventTimes,
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
  it('does not select ambiguous transitions', () => {
    expect(
      detectTrackEventTimes(track([0, 10, 0, 10], [0, 1, 2, 3])).takeoff,
    ).toBeNull();
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
