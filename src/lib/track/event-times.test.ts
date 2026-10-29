import { describe, expect, it } from 'vitest';

import { detectTrackEventTimes, prepareTrackEventTimes } from './event-times';
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
  from: { tz: 'UTC' },
  to: { tz: 'Asia/Hong_Kong' },
  departureScheduled: '1970-01-01T00:00:00.000Z',
  departureScheduledTime: '00:00',
  arrivalScheduled: null,
  arrivalScheduledTime: null,
} as FlightFormData;

describe('track event times', () => {
  it('uses the confirming report at the three-second boundary', () => {
    expect(detectTrackEventTimes(track([0, 10, 20, 0], [0, 3, 6, 9]))).toEqual({
      takeoff: 3,
      landing: 9,
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
        [0, 4],
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
  it('does not select ambiguous transitions', () => {
    expect(
      detectTrackEventTimes(track([0, 10, 0, 10], [0, 1, 2, 3])).takeoff,
    ).toBeNull();
  });
  it('preserves even partially populated fields and validates anyway', () => {
    const result = prepareTrackEventTimes(track([0, 10], [90000, 90001]), {
      ...form,
      takeoffActualTime: '12:00',
    });
    expect(result.values).toEqual({});
    expect(result.warnings).toHaveLength(1);
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
});
