import type { Color, Layer, LayerExtension } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';
import { distance, point } from '@turf/turf';

import type { FlightArc, FlightTrackPath } from './flight-layer-data';
import {
  buildFlightTrackRuns,
  type FlightTrackRun,
} from './flight-track-style';
import type { FlightTrackStyle } from './map-preferences.svelte';

type PathParameters = PathLayerProps<FlightTrackPath>['parameters'];
type PathHoverHandler = PathLayerProps<FlightTrackPath>['onHover'];
type PathClickHandler = PathLayerProps<FlightTrackPath>['onClick'];

export type FlightTrackLayerData = {
  paths: FlightTrackPath[];
  solidRuns: FlightTrackRun[];
  estimatedRuns: FlightTrackRun[];
  groundRuns: FlightTrackRun[];
};

type FlightTrackLayerOptions = {
  data: FlightTrackLayerData;
  style: FlightTrackStyle;
  parameters: PathParameters;
  extensions: LayerExtension[];
  getWidth: (track: FlightArc) => number;
  getStandardColor: (track: FlightTrackPath) => Color;
  getAltitudeColor: (run: FlightTrackRun) => Color;
  getGroundCasingColor: (run: FlightTrackRun) => Color;
  getEstimatedUnderlayColor: (run: FlightTrackRun) => Color;
  widthUpdateTriggers: unknown[];
  standardColorUpdateTriggers: unknown[];
  altitudeColorUpdateTriggers: unknown[];
  onHover: PathHoverHandler;
  onClick: PathClickHandler;
};

const estimatedPathStyle = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});

const surfacePathCache = new WeakMap<
  FlightTrackPath['path'],
  [number, number][]
>();

const GREAT_CIRCLE_MIN_DISTANCE_METERS = 30_000;
const GREAT_CIRCLE_TARGET_SEGMENT_METERS = 19_000;
const ESTIMATED_UNDERLAY_WIDTH_SCALE = 0.56;

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
  start: FlightTrackPath['path'][number],
  end: FlightTrackPath['path'][number],
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

export const buildFlightTrackDisplayPath = (
  sourcePath: FlightTrackPath['path'],
) => {
  if (!sourcePath.length) return [];

  const displayPath: [number, number][] = [
    [sourcePath[0]![0], sourcePath[0]![1]],
  ];

  for (let index = 1; index < sourcePath.length; index++) {
    const start = sourcePath[index - 1]!;
    const end = sourcePath[index]!;
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
      {
        units: 'meters',
      },
    );
    const subdivisionDepth =
      segmentDistance > GREAT_CIRCLE_MIN_DISTANCE_METERS
        ? Math.ceil(
            Math.log2(segmentDistance / GREAT_CIRCLE_TARGET_SEGMENT_METERS),
          )
        : 0;

    if (subdivisionDepth > 0) {
      const arc = subdivideGreatCircle(
        normalizedStart,
        normalizedEnd,
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
          start,
          end,
          2 ** subdivisionDepth,
        );
      }
    }

    displayPath.push([end[0], end[1]]);
  }

  return displayPath;
};

const getSurfacePath = (track: Pick<FlightTrackPath, 'path'>) => {
  const cached = surfacePathCache.get(track.path);
  if (cached) return cached;

  const path = buildFlightTrackDisplayPath(track.path);
  surfacePathCache.set(track.path, path);
  return path;
};

export const prepareFlightTrackLayerData = (
  paths: FlightTrackPath[],
  style: FlightTrackStyle,
): FlightTrackLayerData => {
  const runs = buildFlightTrackRuns(paths, {
    splitByAltitude: style === 'altitude',
  });

  return {
    paths,
    solidRuns: runs.filter((run) => !run.estimated),
    estimatedRuns: runs.filter((run) => run.estimated),
    groundRuns: runs.filter((run) => run.ground),
  };
};

export const buildFlightTrackLayers = ({
  data,
  style,
  parameters,
  extensions,
  getWidth,
  getStandardColor,
  getAltitudeColor,
  getGroundCasingColor,
  getEstimatedUnderlayColor,
  widthUpdateTriggers,
  standardColorUpdateTriggers,
  altitudeColorUpdateTriggers,
  onHover,
  onClick,
}: FlightTrackLayerOptions): Layer[] => {
  const sharedPathOptions = {
    parameters,
    getWidth,
    widthUnits: 'pixels' as const,
    jointRounded: true,
    updateTriggers: {
      getWidth: widthUpdateTriggers,
    },
  };

  return [
    new PathLayer<FlightTrackPath>({
      ...sharedPathOptions,
      id: 'track-path-layer',
      extensions,
      data: style === 'standard' ? data.solidRuns : [],
      getPath: getSurfacePath,
      getColor: getStandardColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: standardColorUpdateTriggers,
      },
    }),
    new PathLayer<FlightTrackRun>({
      ...sharedPathOptions,
      id: 'ground-track-casing-layer',
      extensions,
      data: style === 'altitude' ? data.groundRuns : [],
      getPath: getSurfacePath,
      getColor: getGroundCasingColor,
      getWidth: (run) => getWidth(run) + 2.5,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<FlightTrackRun>({
      ...sharedPathOptions,
      id: 'altitude-track-path-layer',
      extensions,
      data: style === 'altitude' ? data.solidRuns : [],
      getPath: getSurfacePath,
      getColor: getAltitudeColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<FlightTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-underlay-layer',
      extensions,
      data: data.estimatedRuns,
      getPath: getSurfacePath,
      getColor: getEstimatedUnderlayColor,
      getWidth: (run) => getWidth(run) * ESTIMATED_UNDERLAY_WIDTH_SCALE,
      widthMinPixels: 1,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<FlightTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-path-layer',
      extensions: [...extensions, estimatedPathStyle],
      data: data.estimatedRuns,
      getPath: getSurfacePath,
      getColor: style === 'standard' ? getStandardColor : getAltitudeColor,
      getDashArray: (run) => {
        const width = Math.max(1, getWidth(run));
        const halfWidth = width / 2;
        return [10 / halfWidth, (20 + 1.5 * width) / halfWidth];
      },
      dashJustified: false,
      dashGapPickable: false,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor:
          style === 'standard'
            ? standardColorUpdateTriggers
            : altitudeColorUpdateTriggers,
        getDashArray: widthUpdateTriggers,
      },
    }),
    new PathLayer<FlightTrackPath>({
      id: 'ghost-track-path',
      parameters,
      extensions,
      data: data.paths,
      getPath: getSurfacePath,
      getColor: [0, 0, 0, 0],
      getWidth: 18,
      widthUnits: 'pixels',
      pickable: true,
      onHover,
      onClick,
      jointRounded: true,
      capRounded: true,
    }),
  ];
};
