import type { Color, Layer, LayerExtension } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';

import type { FlightTrackStyle } from './map-preferences.svelte';
import type { FlightArc, FlightTrackPath } from './flight-layer-data';
import {
  buildFlightTrackRuns,
  type FlightTrackRun,
} from './flight-track-style';

type PathParameters = PathLayerProps<FlightTrackPath>['parameters'];
type PathHoverHandler = PathLayerProps<FlightTrackPath>['onHover'];
type PathClickHandler = PathLayerProps<FlightTrackPath>['onClick'];

export type FlightTrackLayerData = {
  paths: FlightTrackPath[];
  solidRuns: FlightTrackRun[];
  estimatedRuns: FlightTrackRun[];
};

type FlightTrackLayerOptions = {
  data: FlightTrackLayerData;
  style: FlightTrackStyle;
  parameters: PathParameters;
  extensions: LayerExtension[];
  getWidth: (track: FlightArc) => number;
  getStandardColor: (track: FlightTrackPath) => Color;
  getAltitudeColor: (run: FlightTrackRun) => Color;
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

const getSurfacePath = (track: Pick<FlightTrackPath, 'path'>) => {
  const cached = surfacePathCache.get(track.path);
  if (cached) return cached;

  const path = track.path.map(
    (coordinate) => [coordinate[0], coordinate[1]] as [number, number],
  );
  surfacePathCache.set(track.path, path);
  return path;
};

export const prepareFlightTrackLayerData = (
  paths: FlightTrackPath[],
  style: FlightTrackStyle,
): FlightTrackLayerData => {
  const runs = style === 'altitude' ? buildFlightTrackRuns(paths) : [];

  return {
    paths,
    solidRuns: runs.filter((run) => !run.estimated),
    estimatedRuns: runs.filter((run) => run.estimated),
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
      data: style === 'standard' ? data.paths : [],
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
      id: 'altitude-track-path-layer',
      extensions,
      data: data.solidRuns,
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
      getWidth: (run) => Math.max(1, getWidth(run) * 0.3),
      capRounded: false,
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
      getColor: getAltitudeColor,
      getDashArray: (run) => {
        const width = Math.max(1, getWidth(run));
        return [10 / width, (20 + 3 * width) / width];
      },
      dashJustified: false,
      dashGapPickable: false,
      capRounded: false,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
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
