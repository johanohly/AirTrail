import { describe, expect, it } from 'vitest';

import type { FlightTrackPath } from './flight-layer-data';
import {
  buildFlightTrackRuns,
  getFlightTrackColor,
  metersToFeet,
  roundFlightTrackAltitude,
} from './flight-track-style';

const track = (
  path: FlightTrackPath['path'],
  options: Pick<FlightTrackPath, 'ground' | 'estimated'> = {},
) =>
  ({
    flightId: 1,
    path,
    ...options,
  }) as FlightTrackPath;

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
        palette: 'tar1090',
      }),
    ).toEqual([77, 77, 77]);
    expect(
      getFlightTrackColor({
        altitudeFeet: null,
        ground: false,
        palette: 'tar1090',
      }),
    ).toEqual([191, 191, 191]);
  });

  it('exposes exact AirTrail palette anchors', () => {
    expect(
      getFlightTrackColor({
        altitudeFeet: 0,
        ground: false,
        palette: 'airtrail',
      }),
    ).toEqual([249, 115, 22]);
    expect(
      getFlightTrackColor({
        altitudeFeet: 11_000,
        ground: false,
        palette: 'airtrail',
      }),
    ).toEqual([6, 182, 212]);
    expect(
      getFlightTrackColor({
        altitudeFeet: 51_000,
        ground: false,
        palette: 'airtrail',
      }),
    ).toEqual([239, 68, 68]);
  });

  it('darkens estimated segments in addition to dashing them', () => {
    const actual = getFlightTrackColor({
      altitudeFeet: 10_000,
      ground: false,
      palette: 'tar1090',
    });
    const estimated = getFlightTrackColor({
      altitudeFeet: 10_000,
      ground: false,
      estimated: true,
      palette: 'tar1090',
    });
    expect(estimated[0]).toBeLessThan(actual[0]);
    expect(estimated[1]).toBeLessThan(actual[1]);
    expect(estimated[2]).toBeLessThan(actual[2]);
  });

  it('merges consecutive edges with the same rounded style', () => {
    const runs = buildFlightTrackRuns([
      track(
        [
          [10, 55, 304.8],
          [11, 56, 307.8],
          [12, 57, 365.76],
          [13, 58, 368.8],
        ],
        { estimated: [false, false, true, true] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      altitudeFeet: 1_000,
      estimated: false,
      path: [
        [10, 55, 304.8],
        [11, 56, 307.8],
        [12, 57, 365.76],
      ],
    });
    expect(runs[1]).toMatchObject({
      altitudeFeet: 1_200,
      estimated: true,
      path: [
        [12, 57, 365.76],
        [13, 58, 368.8],
      ],
    });
  });

  it('uses the starting point flags for each edge', () => {
    const runs = buildFlightTrackRuns([
      track(
        [
          [10, 55, 0],
          [11, 56, 304.8],
          [12, 57, 609.6],
        ],
        { ground: [true, false, false], estimated: [false, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ ground: true, estimated: false });
    expect(runs[1]).toMatchObject({ ground: false, estimated: true });
  });

  it('keeps ground runs together when recorded altitude changes', () => {
    const runs = buildFlightTrackRuns([
      track(
        [
          [10, 55, 0],
          [11, 56, 100],
          [12, 57, 200],
        ],
        { ground: [true, true, false] },
      ),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      altitudeFeet: null,
      ground: true,
      path: [
        [10, 55, 0],
        [11, 56, 100],
        [12, 57, 200],
      ],
    });
  });
});
