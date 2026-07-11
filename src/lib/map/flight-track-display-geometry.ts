import { distance, point } from '@turf/turf';

import type { FlightTrackCoordinate } from '$lib/track/schema';

const GREAT_CIRCLE_MIN_DISTANCE_METERS = 30_000;
const GREAT_CIRCLE_TARGET_SEGMENT_METERS = 19_000;
export const MAX_FLIGHT_TRACK_DISPLAY_POINTS = 50_000;

export type FlightTrackDisplaySource = {
  path: FlightTrackCoordinate[];
  layerCount: number;
};

const normalizeLongitude = (longitude: number) =>
  ((((longitude + 180) % 360) + 360) % 360) - 180;

const unwrapLongitude = (longitude: number, previous: number) => {
  let unwrapped = longitude;
  while (unwrapped - previous > 180) unwrapped -= 360;
  while (unwrapped - previous < -180) unwrapped += 360;
  return unwrapped;
};

const interpolateLinearSegment = (
  path: [number, number][],
  start: FlightTrackCoordinate,
  end: FlightTrackCoordinate,
  segmentCount: number,
) => {
  for (let index = 1; index < segmentCount; index++) {
    const progress = index / segmentCount;
    path.push([
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
    ]);
  }
};

const greatCircleMidpoint = (
  from: [number, number],
  to: [number, number],
): [number, number] | null => {
  const longitude1 = (from[0] * Math.PI) / 180;
  const latitude1 = (from[1] * Math.PI) / 180;
  const longitude2 = (to[0] * Math.PI) / 180;
  const latitude2 = (to[1] * Math.PI) / 180;
  const longitudeDifference = longitude2 - longitude1;
  const bx = Math.cos(latitude2) * Math.cos(longitudeDifference);
  const by = Math.cos(latitude2) * Math.sin(longitudeDifference);
  const x = Math.cos(latitude1) + bx;
  const y = by;

  if (Math.hypot(x, y) < Number.EPSILON) return null;

  const latitude = Math.atan2(
    Math.sin(latitude1) + Math.sin(latitude2),
    Math.hypot(x, y),
  );
  const longitude = longitude1 + Math.atan2(by, x);
  return [
    normalizeLongitude((longitude * 180) / Math.PI),
    (latitude * 180) / Math.PI,
  ];
};

const subdivideGreatCircle = (
  start: [number, number],
  end: [number, number],
  depth: number,
) => {
  let coordinates = [start, end];

  for (let level = 0; level < depth; level++) {
    const subdivided: [number, number][] = [coordinates[0]!];
    for (let index = 1; index < coordinates.length; index++) {
      const midpoint = greatCircleMidpoint(
        coordinates[index - 1]!,
        coordinates[index]!,
      );
      if (!midpoint) return null;
      subdivided.push(midpoint, coordinates[index]!);
    }
    coordinates = subdivided;
  }

  return coordinates;
};

const prepareDisplaySegments = (path: FlightTrackCoordinate[]) =>
  path.slice(1).map((end, offset) => {
    const start = path[offset]!;
    const normalizedStart: [number, number] = [
      normalizeLongitude(start[0]),
      start[1],
    ];
    const normalizedEnd: [number, number] = [
      normalizeLongitude(end[0]),
      end[1],
    ];
    const segmentDistance = distance(
      point(normalizedStart),
      point(normalizedEnd),
      { units: 'meters' },
    );
    const subdivisionDepth =
      segmentDistance > GREAT_CIRCLE_MIN_DISTANCE_METERS
        ? Math.ceil(
            Math.log2(segmentDistance / GREAT_CIRCLE_TARGET_SEGMENT_METERS),
          )
        : 0;

    return {
      start,
      end,
      normalizedStart,
      normalizedEnd,
      subdivisionDepth,
    };
  });

type PreparedDisplaySegments = ReturnType<typeof prepareDisplaySegments>;

const countDisplayPoints = (
  segments: PreparedDisplaySegments,
  depthCeiling: number,
) =>
  segments.length === 0
    ? 0
    : 1 +
      segments.reduce(
        (total, segment) =>
          total + 2 ** Math.min(segment.subdivisionDepth, depthCeiling),
        0,
      );

const findSharedDepthCeiling = (
  prepared: Array<{
    segments: PreparedDisplaySegments;
    layerCount: number;
  }>,
) => {
  let depthCeiling = prepared.reduce(
    (maximum, item) =>
      item.segments.reduce(
        (pathMaximum, segment) =>
          Math.max(pathMaximum, segment.subdivisionDepth),
        maximum,
      ),
    0,
  );
  const totalPointCount = (maximumDepth: number) =>
    prepared.reduce(
      (total, item) =>
        total +
        item.layerCount * countDisplayPoints(item.segments, maximumDepth),
      0,
    );

  while (
    depthCeiling > 0 &&
    totalPointCount(depthCeiling) > MAX_FLIGHT_TRACK_DISPLAY_POINTS
  ) {
    depthCeiling--;
  }

  return depthCeiling;
};

const buildDisplayPath = (
  sourcePath: FlightTrackCoordinate[],
  segments: PreparedDisplaySegments,
  depthCeiling: number,
) => {
  if (!sourcePath.length) return [];

  const displayPath: [number, number][] = [
    [sourcePath[0]![0], sourcePath[0]![1]],
  ];

  for (const segment of segments) {
    const subdivisionDepth = Math.min(segment.subdivisionDepth, depthCeiling);

    if (subdivisionDepth > 0) {
      const arc = subdivideGreatCircle(
        segment.normalizedStart,
        segment.normalizedEnd,
        subdivisionDepth,
      );

      if (arc) {
        for (const coordinate of arc.slice(1, -1)) {
          const previousLongitude = displayPath.at(-1)![0];
          displayPath.push([
            unwrapLongitude(coordinate[0], previousLongitude),
            coordinate[1],
          ]);
        }
      } else {
        // Antipodal points have no unique great-circle route. A deterministic
        // surface interpolation still avoids drawing a chord through the globe.
        interpolateLinearSegment(
          displayPath,
          segment.start,
          segment.end,
          2 ** subdivisionDepth,
        );
      }
    }

    displayPath.push([segment.end[0], segment.end[1]]);
  }

  return displayPath;
};

export const buildFlightTrackDisplayPaths = (
  sources: FlightTrackDisplaySource[],
) => {
  const prepared = sources.map(({ path, layerCount }) => ({
    path,
    layerCount,
    segments: prepareDisplaySegments(path),
  }));
  const depthCeiling = findSharedDepthCeiling(prepared);

  return prepared.map(({ path, segments }) =>
    buildDisplayPath(path, segments, depthCeiling),
  );
};

export const buildFlightTrackDisplayPath = (
  sourcePath: FlightTrackCoordinate[],
) => buildFlightTrackDisplayPaths([{ path: sourcePath, layerCount: 1 }])[0]!;
