import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import { describe, expect, it } from 'vitest';

import { reduceFlightTrackForMap } from './render';
import {
  MAX_RENDERED_FLIGHT_TRACK_POINTS,
  type FlightTrackCoordinate,
  type FlightTrackPayload,
} from './schema';

const groundDistance = (
  left: FlightTrackCoordinate,
  right: FlightTrackCoordinate,
) => distance(left.slice(0, 2), right.slice(0, 2), { units: 'meters' });

const cumulativeDistances = (coordinates: FlightTrackCoordinate[]) => {
  const distances = [0];
  for (let index = 1; index < coordinates.length; index++) {
    distances.push(
      distances[index - 1]! +
        groundDistance(coordinates[index - 1]!, coordinates[index]!),
    );
  }
  return distances;
};

const expectReconstructionWithinTolerance = (
  original: FlightTrackCoordinate[],
  retained: FlightTrackCoordinate[],
) => {
  const indices = retained.map((coordinate) => original.indexOf(coordinate));
  for (let edge = 1; edge < indices.length; edge++) {
    const start = indices[edge - 1]!;
    const end = indices[edge]!;
    const from = original[start]!;
    const to = original[end]!;
    const arcLength = groundDistance(from, to);
    const segment = lineString([from.slice(0, 2), to.slice(0, 2)]);
    for (let index = start + 1; index < end; index++) {
      const coordinate = original[index]!;
      const nearest = nearestPointOnLine(segment, coordinate.slice(0, 2), {
        units: 'meters',
      });
      expect(nearest.properties.pointDistance).toBeLessThanOrEqual(30);
      if (
        coordinate[2] === undefined ||
        from[2] === undefined ||
        to[2] === undefined
      )
        continue;
      const progress =
        groundDistance(from, nearest.geometry.coordinates as [number, number]) /
        arcLength;
      const reconstructedAltitude = from[2] + progress * (to[2] - from[2]);
      expect(
        Math.abs(coordinate[2] - reconstructedAltitude),
      ).toBeLessThanOrEqual(15);
    }
  }
};

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
  it('returns a two-point track unchanged when no gap is detected', () => {
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
    const reduced = reduceFlightTrackForMap(track);

    expect(reduced.coordinates.length).toBeLessThan(track.coordinates.length);
    expect(reduced.coordinates.slice(0, 10)).toEqual(
      track.coordinates.slice(0, 10),
    );
    expect(reduced.coordinates).toContainEqual(track.coordinates[3_000]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[9]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[10]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[1_999]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[2_000]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[3_999]);
    expect(reduced.coordinates).toContainEqual(track.coordinates[4_000]);

    for (const key of [
      'times',
      'groundSpeedKt',
      'trackDeg',
      'ground',
      'estimated',
    ] as const) {
      expect(reduced[key]).toEqual(
        reduced.coordinates.map(
          (coordinate) => track[key]![track.coordinates.indexOf(coordinate)],
        ),
      );
    }
    expect(reduced.estimated).toContain(true);
    expect(reduced.ground).toContain(true);
  });

  it('keeps every estimated edge and both sides of state and altitude transitions', () => {
    const coordinates: FlightTrackPayload['coordinates'] = Array.from(
      { length: 12 },
      (_, index) =>
        index >= 9
          ? [index, 0]
          : ([index, 0, 1_000] as [number, number, number]),
    );
    const track: FlightTrackPayload = {
      coordinates,
      ground: coordinates.map((_, index) => index === 2),
      estimated: coordinates.map((_, index) => index >= 6),
    };

    const reduced = reduceFlightTrackForMap(track);
    const retained = new Set(
      reduced.coordinates.map(([longitude]) => longitude),
    );

    expect(retained).toEqual(new Set([0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11]));
    expect(reduced.ground).toHaveLength(reduced.coordinates.length);
    expect(reduced.estimated).toHaveLength(reduced.coordinates.length);
  });

  it('reduces a short polar great-circle track crossing the antimeridian', () => {
    const coordinates: FlightTrackCoordinate[] = [
      [90, 80],
      [90, 85],
      [180, 90],
      [-90, 85],
      [-90, 80],
    ];
    const reduced = reduceFlightTrackForMap({ coordinates });
    expect(reduced.coordinates).toEqual([coordinates[0], coordinates.at(-1)]);
    expectReconstructionWithinTolerance(coordinates, reduced.coordinates);
  });

  it('uses the finite arc and splits nearly antipodal candidates', () => {
    for (const coordinates of [
      [
        [0, 0],
        [-1, 0],
        [1, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [179.999_999, 0],
      ],
    ] satisfies FlightTrackCoordinate[][]) {
      expect(reduceFlightTrackForMap({ coordinates }).coordinates).toEqual(
        coordinates,
      );
    }
  });

  it('rechecks horizontal error after a vertical split changes the arcs', () => {
    const coordinates: FlightTrackCoordinate[] = [
      [0, 0, 1_000],
      [0.001, 0.000_22, 1_100],
      [0.002, -0.000_22, 1_055],
      [0.003, 0, 1_000],
    ];
    const flat = coordinates.map(([lon, lat]): FlightTrackCoordinate => [
      lon,
      lat,
    ]);
    expect(
      reduceFlightTrackForMap({ coordinates: flat }).coordinates,
    ).toHaveLength(2);
    expect(reduceFlightTrackForMap({ coordinates }).coordinates).toEqual(
      coordinates,
    );
  });

  it('refines a climb whose altitude misses the retained arc', () => {
    const horizontal: FlightTrackCoordinate[] = Array.from(
      { length: 21 },
      (_, index) => [
        index * 0.001,
        index > 0 && index < 10 ? (index % 2 ? 0.000_22 : -0.000_22) : 0,
      ],
    );
    const distances = cumulativeDistances(horizontal);
    const coordinates: FlightTrackCoordinate[] = horizontal.map(
      ([lon, lat], index) => [lon, lat, 1_000 + 2 * distances[index]!],
    );
    expect(
      reduceFlightTrackForMap({ coordinates: horizontal }).coordinates,
    ).toHaveLength(2);
    const reduced = reduceFlightTrackForMap({ coordinates });
    expect(reduced.coordinates.length).toBeGreaterThan(2);
    expect(reduced.coordinates.length).toBeLessThan(coordinates.length);
    expectReconstructionWithinTolerance(coordinates, reduced.coordinates);
  });

  it('keeps coincident observations when their altitude changes', () => {
    const coordinates: FlightTrackCoordinate[] = [
      [10, 10, 1_000],
      [10, 10, 1_020],
      [10, 10, 1_040],
    ];
    expect(reduceFlightTrackForMap({ coordinates }).coordinates).toEqual(
      coordinates,
    );
  });

  it('uses exact zero for preservation only when ground flags are unavailable', () => {
    const coordinates: FlightTrackCoordinate[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    expect(reduceFlightTrackForMap({ coordinates })).toEqual({ coordinates });
    const track = { coordinates, times: [0, 80, 85] };
    expect(reduceFlightTrackForMap(track)).toEqual({
      ...track,
      estimated: [false, true, false],
    });
    expect(
      reduceFlightTrackForMap({ coordinates, ground: [false, false, false] }),
    ).toEqual({
      coordinates: [coordinates[0], coordinates[2]],
      ground: [false, false],
    });
  });

  it('keeps every ground observation when the track fits the cap', () => {
    const coordinates: FlightTrackCoordinate[] = Array.from(
      { length: 5_000 },
      (_, index) => [10 + index * 0.000_001, 55, 70],
    );
    const track = { coordinates, ground: coordinates.map(() => true) };
    expect(reduceFlightTrackForMap(track)).toBe(track);
  });

  it.each([
    ['noisy', (index: number) => Math.sin(index * 0.37) * 0.000_5],
    ['straight', () => 0],
  ] as const)(
    'uses the whole budget on an oversized %s ground track',
    (_, latitudeAt) => {
      const coordinates: FlightTrackCoordinate[] = Array.from(
        { length: 20_000 },
        (_, index) => [index * 0.001, latitudeAt(index), 0],
      );
      const track = { coordinates };
      const reduced = reduceFlightTrackForMap(track);
      expect(reduced.coordinates).toHaveLength(
        MAX_RENDERED_FLIGHT_TRACK_POINTS,
      );
      expect(reduced.coordinates[0]).toBe(coordinates[0]);
      expect(reduced.coordinates.at(-1)).toBe(coordinates.at(-1));
      expect(reduceFlightTrackForMap(track)).toEqual(reduced);
    },
  );

  it('allocates the last slot to the greatest normalized error across spans', () => {
    const track: FlightTrackPayload = {
      coordinates: [
        [0, 0],
        [0.001, 0.000_4], // About 44 m horizontally (score 1.5).
        [0.002, 0],
        [0.003, 0, 1_000],
        [0.004, 0, 1_030], // 30 m vertically (score 2).
        [0.005, 0, 1_000],
        [0.006, 0, 1_000],
        [0.007, 0, 1_000],
        [0.008, 0, 1_000],
      ],
      ground: [true, true, true, false, false, false, false, false, false],
      times: [0, 1, 2, 3, 4, 5, 90, 91, 92],
    };
    const retained = [0, 2, 3, 4, 5, 6, 7, 8];
    expect(reduceFlightTrackForMap(track, 8)).toEqual({
      coordinates: retained.map((index) => track.coordinates[index]),
      ground: retained.map((index) => track.ground![index]),
      times: retained.map((index) => track.times![index]),
      estimated: retained.map((index) => index === 6),
    });
  });

  it('preserves mandatory gap observations even when they exceed the budget', () => {
    const length = MAX_RENDERED_FLIGHT_TRACK_POINTS + 2;
    const coordinates: FlightTrackCoordinate[] = Array.from({ length }, () => [
      0, 0,
    ]);
    const track = {
      coordinates,
      estimated: coordinates.map((_, index) => index >= 3),
    };
    expect(reduceFlightTrackForMap(track)).toEqual({
      coordinates: [coordinates[0], ...coordinates.slice(2)],
      estimated: [false, ...track.estimated.slice(2)],
    });
  });
});
