import { describe, expect, it } from 'vitest';

import { reduceFlightTrackForMap } from './render';
import type { FlightTrackPayload } from './schema';

const buildDetailedTrack = (): FlightTrackPayload => {
  const pointCount = 6_001;
  const coordinates = Array.from({ length: pointCount }, (_, index) => {
    const altitude =
      index <= 3_000
        ? (index / 3_000) * 9_144
        : ((6_000 - index) / 3_000) * 9_144;
    return [index * 0.000_1, 55, altitude] as [number, number, number];
  });

  return {
    coordinates,
    times: coordinates.map((_, index) => 1_700_000_000 + index),
    groundSpeedKt: coordinates.map((_, index) => index / 10),
    trackDeg: coordinates.map(() => 90),
    ground: coordinates.map((_, index) => index < 10),
    estimated: coordinates.map((_, index) => index >= 2_000 && index < 4_000),
  };
};

describe('flight track map reduction', () => {
  it('returns stored tracks unchanged when they fit the render limit', () => {
    const track: FlightTrackPayload = {
      coordinates: [
        [10, 55],
        [11, 56],
      ],
    };

    expect(reduceFlightTrackForMap(track)).toBe(track);
  });

  it('marks gaps using tar1090 current-point timeouts', () => {
    const track: FlightTrackPayload = {
      coordinates: [
        [12.65, 55.62],
        [12.66, 55.63],
        [12.67, 55.64],
      ],
      times: [0, 94, 95],
      ground: [true, true, true],
    };

    expect(reduceFlightTrackForMap(track).estimated).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('uses the destination ground state for the gap timeout', () => {
    const track: FlightTrackPayload = {
      coordinates: [
        [12.65, 55.62],
        [12.66, 55.63],
        [12.67, 55.64],
      ],
      times: [0, 80, 160],
      ground: [true, false, true],
    };

    expect(reduceFlightTrackForMap(track).estimated).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('keeps altitude extrema and semantic transitions', () => {
    const track = buildDetailedTrack();
    const reduced = reduceFlightTrackForMap(track, 50);

    expect(reduced.coordinates).toHaveLength(50);
    expect(reduced.coordinates).toContainEqual(track.coordinates[3_000]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[9]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[10]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[1_999]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[2_000]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[3_999]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[4_000]);

    for (const property of [
      reduced.times,
      reduced.groundSpeedKt,
      reduced.trackDeg,
      reduced.ground,
      reduced.estimated,
    ]) {
      expect(property).toHaveLength(reduced.coordinates.length);
    }
    expect(reduced.estimated).toContain(true);
    expect(reduced.ground).toContain(true);
  });

  it('keeps semantic transition groups intact when they exceed the limit', () => {
    const coordinates: FlightTrackPayload['coordinates'] = Array.from(
      { length: 12 },
      (_, index) =>
        index >= 9
          ? [index, 55]
          : ([index, 55, 1_000] as [number, number, number]),
    );
    const track: FlightTrackPayload = {
      coordinates,
      ground: coordinates.map((_, index) => index === 2),
      estimated: coordinates.map((_, index) => index >= 6),
    };

    const reduced = reduceFlightTrackForMap(track, 7);
    const retained = new Set(
      reduced.coordinates.map(([longitude]) => longitude),
    );

    for (const group of [
      [1, 2, 3],
      [5, 6],
      [8, 9],
    ]) {
      const retainedCount = group.filter((index) => retained.has(index)).length;
      expect(retainedCount === 0 || retainedCount === group.length).toBe(true);
    }
    expect(reduced.coordinates.length).toBeLessThanOrEqual(7);
    expect(reduced.ground).toHaveLength(reduced.coordinates.length);
    expect(reduced.estimated).toHaveLength(reduced.coordinates.length);
  });
});
