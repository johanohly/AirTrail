import { describe, expect, it } from 'vitest';

import { measureTrackDistance } from './distance';
import type { FlightTrackCoordinate } from './schema';

/** One degree of longitude along the equator, in km. */
const DEGREE_KM = 111.195;

// An aircraft flying east along the equator at 800 km/h, one point a minute.
const cruise = (minutes: number) => {
  const coordinates: FlightTrackCoordinate[] = [];
  const times: number[] = [];
  for (let minute = 0; minute <= minutes; minute++) {
    coordinates.push([(minute * 800) / 60 / DEGREE_KM, 0]);
    times.push(1_780_000_000 + minute * 60);
  }
  return { coordinates, times };
};

describe('measureTrackDistance', () => {
  it('sums the segments of a track without timestamps', () => {
    expect(
      measureTrackDistance({
        coordinates: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      }),
    ).toBeCloseTo(2 * DEGREE_KM, 0);
  });

  it('measures a clean timed track in full', () => {
    expect(measureTrackDistance(cruise(60))).toBeCloseTo(800, 0);
  });

  it('skips a single spoofed position', () => {
    const track = cruise(60);
    track.coordinates[30] = [track.coordinates[30]![0], 3];

    expect(measureTrackDistance(track)).toBeCloseTo(800, 0);
  });

  it('skips a run of spoofed positions until the real ones return', () => {
    const track = cruise(60);
    for (let i = 20; i < 30; i++) {
      track.coordinates[i] = [33.5, 34.8];
    }

    expect(measureTrackDistance(track)).toBeCloseTo(800, 0);
  });

  it('keeps a fast but real ground speed', () => {
    const coordinates: FlightTrackCoordinate[] = [
      [0, 0],
      [1300 / DEGREE_KM, 0],
    ];

    expect(measureTrackDistance({ coordinates, times: [0, 3600] })).toBeCloseTo(
      1300,
      0,
    );
  });

  it('keeps sub-kilometre jitter, even with repeated timestamps', () => {
    const jitter = 0.5 / DEGREE_KM;

    expect(
      measureTrackDistance({
        coordinates: [
          [0, 0],
          [jitter, 0],
        ],
        times: [0, 0],
      }),
    ).toBeCloseTo(0.5, 1);
  });

  it('counts a jump in full when the track has no timestamps', () => {
    const { coordinates } = cruise(60);
    coordinates[30] = [coordinates[30]![0], 3];

    expect(measureTrackDistance({ coordinates })).toBeGreaterThan(1400);
  });
});
