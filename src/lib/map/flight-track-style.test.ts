import { describe, expect, it } from 'vitest';

import type { FlightTrackPath } from './flight-layer-data';
import { prepareFlightTrackLayerData } from './flight-track-layers';
import {
  getFlightTrackColor,
  metersToFeet,
  roundFlightTrackAltitude,
} from './flight-track-style';

import {
  toFlightTrackSamples,
  type FlightTrackCoordinate,
} from '$lib/track/schema';

const track = (
  coordinates: FlightTrackCoordinate[],
  options: { ground?: boolean[]; estimated?: boolean[] } = {},
) =>
  ({
    flightId: 1,
    originalPointCount: coordinates.length,
    samples: toFlightTrackSamples({ coordinates, ...options }),
  }) as FlightTrackPath;

const buildRuns = (
  tracks: FlightTrackPath[],
  style: 'altitude' | 'standard' = 'altitude',
) => {
  const data = prepareFlightTrackLayerData(tracks, style);
  return [...data.solidRuns, ...data.estimatedRuns];
};

describe('flight track styling', () => {
  it('converts metres and rounds like tar1090', () => {
    expect(metersToFeet(304.8)).toBeCloseTo(1_000);
    expect(roundFlightTrackAltitude(7_974)).toBe(7_950);
    expect(roundFlightTrackAltitude(8_240)).toBe(8_000);
    expect(roundFlightTrackAltitude(8_260)).toBe(8_500);
  });

  it('uses ground and unknown colors before altitude', () => {
    expect(
      getFlightTrackColor({
        altitudeFeet: 30_000,
        ground: true,
      }),
    ).toEqual([82, 82, 91]);
    expect(
      getFlightTrackColor({
        altitudeFeet: 30_000,
        ground: true,
        darkMode: true,
      }),
    ).toEqual([228, 228, 231]);
    expect(
      getFlightTrackColor({
        altitudeFeet: null,
        ground: false,
      }),
    ).toEqual([161, 161, 170]);
  });

  it('keeps estimated ground tracks visible in dark mode', () => {
    expect(
      getFlightTrackColor({
        altitudeFeet: null,
        ground: true,
        estimated: true,
        darkMode: true,
      }),
    ).toEqual([179, 179, 188]);
  });

  it('exposes exact AirTrail palette anchors', () => {
    expect(
      getFlightTrackColor({
        altitudeFeet: 0,
        ground: false,
      }),
    ).toEqual([249, 115, 22]);
    expect(
      getFlightTrackColor({
        altitudeFeet: 11_000,
        ground: false,
      }),
    ).toEqual([6, 182, 212]);
    expect(
      getFlightTrackColor({
        altitudeFeet: 51_000,
        ground: false,
      }),
    ).toEqual([239, 68, 68]);
  });

  it('darkens estimated segments in HSL like tar1090', () => {
    const actual = getFlightTrackColor({
      altitudeFeet: 0,
      ground: false,
    });
    const estimated = getFlightTrackColor({
      altitudeFeet: 0,
      ground: false,
      estimated: true,
    });
    expect(estimated[0]).toBeLessThan(actual[0]);
    expect(estimated[1]).toBeLessThan(actual[1]);
    expect(estimated[2]).toBeLessThan(actual[2]);
    expect(estimated).toEqual([211, 90, 5]);
  });

  it('merges consecutive edges with the same rounded style', () => {
    const runs = buildRuns([
      track(
        [
          [10, 55, 304.8],
          [10.01, 55, 307.8],
          [10.02, 55, 304.8],
          [10.03, 55, 306],
        ],
        { estimated: [false, false, false, true] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      altitudeFeet: 1_000,
      estimated: false,
      displayPath: [
        [10, 55],
        [10.01, 55],
        [10.02, 55],
      ],
    });
    expect(runs[1]).toMatchObject({
      altitudeFeet: 1_000,
      estimated: true,
      displayPath: [
        [10.02, 55],
        [10.03, 55],
      ],
    });
  });

  it('uses starting-point flight state and destination-point uncertainty', () => {
    const runs = buildRuns([
      track(
        [
          [10, 55, 0],
          [11, 56, 304.8],
          [12, 57, 304.8],
        ],
        { ground: [true, false, false], estimated: [false, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ ground: false, estimated: false });
    expect(runs[1]).toMatchObject({ ground: true, estimated: true });
  });

  it('keeps ground runs together when recorded altitude changes', () => {
    const runs = buildRuns([
      track(
        [
          [10, 55, 0],
          [10.01, 55, 100],
          [10.02, 55, 200],
        ],
        { ground: [true, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      altitudeFeet: null,
      ground: true,
      displayPath: [
        [10, 55],
        [10.01, 55],
        [10.02, 55],
      ],
    });
  });

  it('only splits standard runs at estimated boundaries', () => {
    const runs = buildRuns(
      [
        track(
          [
            [10, 55, 0],
            [11, 56, 304.8],
            [12, 57, 304.8],
          ],
          { ground: [true, false, false], estimated: [false, false, false] },
        ),
      ],
      'standard',
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      altitudeFeet: null,
      ground: false,
      estimated: false,
    });
    expect(runs[0]).not.toHaveProperty('samples');
  });
});
