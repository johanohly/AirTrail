import {
  createGreatCircleArc,
  EARTH_RADIUS_METERS,
  interpolateGreatCircleArc,
  toUnitVector,
} from '$lib/track/great-circle';
import type { FlightTrackCoordinate } from '$lib/track/schema';

const GREAT_CIRCLE_MIN_DISTANCE_METERS = 30_000;
const GREAT_CIRCLE_TARGET_SEGMENT_METERS = 19_000;
export const MAX_FLIGHT_TRACK_DISPLAY_POINTS = 50_000;

const unwrapLongitude = (longitude: number, previous: number) => {
  const delta = longitude - previous;
  if (delta > 180) return longitude - 360 * Math.ceil((delta - 180) / 360);
  if (delta < -180) return longitude + 360 * Math.ceil((-delta - 180) / 360);
  return longitude;
};

export const prepareFlightTrackDisplaySegments = (
  path: FlightTrackCoordinate[],
) =>
  path.slice(1).map((end, offset) => {
    const start = path[offset]!;
    const arc = createGreatCircleArc(
      toUnitVector(start[0], start[1]),
      toUnitVector(end[0], end[1]),
    );
    const distance = arc.angle * EARTH_RADIUS_METERS;
    const subdivisionDepth =
      distance > GREAT_CIRCLE_MIN_DISTANCE_METERS
        ? Math.ceil(Math.log2(distance / GREAT_CIRCLE_TARGET_SEGMENT_METERS))
        : 0;
    const coordinateAt = (progress: number): readonly [number, number] => {
      if (progress === 1) return [end[0], end[1]];
      if (arc.kind === 'arc') return interpolateGreatCircleArc(arc, progress);

      // An antipodal pair has no unique shorter arc. Keep its surface fallback.
      const endLongitude = unwrapLongitude(end[0], start[0]);
      return [
        start[0] + (endLongitude - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
      ];
    };

    return {
      subdivisionDepth,
      coordinateAt,
      coincident: arc.kind === 'coincident',
    };
  });

export const findSharedDepthCeiling = (
  requiredPoints: number,
  segments: { subdivisionDepth: number; layerCount: number }[],
) => {
  let ceiling = segments.reduce(
    (maximum, segment) => Math.max(maximum, segment.subdivisionDepth),
    0,
  );
  const totalPoints = (depth: number) =>
    segments.reduce(
      (total, segment) =>
        total +
        segment.layerCount *
          (2 ** Math.min(segment.subdivisionDepth, depth) - 1),
      requiredPoints,
    );

  // Colour boundaries that coincide with optional points can only lower this count.
  while (
    ceiling > 0 &&
    totalPoints(ceiling) > MAX_FLIGHT_TRACK_DISPLAY_POINTS
  ) {
    ceiling--;
  }
  return ceiling;
};

export const appendDisplayPoint = (
  path: [number, number][],
  [longitude, latitude]: readonly [number, number],
) => {
  const coordinate: [number, number] = [
    unwrapLongitude(longitude, path.at(-1)![0]),
    latitude,
  ];
  path.push(coordinate);
  return coordinate;
};
