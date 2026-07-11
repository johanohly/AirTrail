import type { Color, LayerExtension } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';

import type {
  FlightArc,
  FlightTrackIdentity,
  FlightTrackPath,
} from './flight-layer-data';
import { buildFlightTrackDisplayPaths } from './flight-track-display-geometry';
import {
  buildFlightTrackRuns,
  type FlightTrackRun,
} from './flight-track-style';
import type { FlightTrackStyle } from './map-preferences.svelte';

type PathParameters = PathLayerProps<FlightTrackPath>['parameters'];
type PathHoverHandler = PathLayerProps<FlightTrackPath>['onHover'];
type PathClickHandler = PathLayerProps<FlightTrackPath>['onClick'];

export type RenderableFlightTrackPath = FlightTrackPath & {
  displayPath: [number, number][];
};

export type RenderableFlightTrackRun = FlightTrackRun & {
  displayPath: [number, number][];
};

export type FlightTrackLayerData = {
  paths: RenderableFlightTrackPath[];
  solidRuns: RenderableFlightTrackRun[];
  estimatedRuns: RenderableFlightTrackRun[];
  groundRuns: RenderableFlightTrackRun[];
};

type FlightTrackLayerOptions = {
  data: FlightTrackLayerData;
  style: FlightTrackStyle;
  context: FlightTrackRenderContext;
};

export type FlightTrackRenderContext = {
  geometry: {
    parameters: PathParameters;
    extensions: LayerExtension[];
  };
  appearance: {
    getWidth: (track: FlightArc) => number;
    getStandardColor: (track: FlightTrackIdentity) => Color;
    getAltitudeColor: (run: FlightTrackRun) => Color;
    getGroundCasingColor: (run: FlightTrackRun) => Color;
    getEstimatedUnderlayColor: (run: FlightTrackRun) => Color;
    updateTriggers: {
      width: readonly unknown[];
      standardColor: readonly unknown[];
      altitudeColor: readonly unknown[];
    };
  };
  interaction: {
    onHover: PathHoverHandler;
    onClick: PathClickHandler;
  };
};

const estimatedPathStyle = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});
const ESTIMATED_UNDERLAY_WIDTH_SCALE = 0.56;

export const prepareFlightTrackLayerData = (
  paths: FlightTrackPath[],
  style: FlightTrackStyle,
): FlightTrackLayerData => {
  const preparedPaths: RenderableFlightTrackPath[] = [];
  const preparedRuns: RenderableFlightTrackRun[] = [];

  for (const path of paths) {
    const sourcePath = path.samples.map((sample) => sample.coordinate);
    const runs = buildFlightTrackRuns([path], {
      splitByAltitude: style === 'altitude',
    });
    const [trackDisplayPath, ...runDisplayPaths] = buildFlightTrackDisplayPaths(
      [
        { path: sourcePath, layerCount: 1 },
        ...runs.map((run) => ({
          path: run.path,
          layerCount:
            (run.estimated ? 2 : 1) +
            (style === 'altitude' && run.ground ? 1 : 0),
        })),
      ],
    );

    preparedPaths.push({
      ...path,
      displayPath: trackDisplayPath!,
    });
    preparedRuns.push(
      ...runs.map((run, index) => ({
        ...run,
        displayPath: runDisplayPaths[index]!,
      })),
    );
  }

  return {
    paths: preparedPaths,
    solidRuns: preparedRuns.filter((run) => !run.estimated),
    estimatedRuns: preparedRuns.filter((run) => run.estimated),
    groundRuns: preparedRuns.filter((run) => run.ground),
  };
};

export const buildFlightTrackLayers = ({
  data,
  style,
  context: {
    geometry: { parameters, extensions },
    appearance: {
      getWidth,
      getStandardColor,
      getAltitudeColor,
      getGroundCasingColor,
      getEstimatedUnderlayColor,
      updateTriggers: {
        width: widthUpdateTriggers,
        standardColor: standardColorUpdateTriggers,
        altitudeColor: altitudeColorUpdateTriggers,
      },
    },
    interaction: { onHover, onClick },
  },
}: FlightTrackLayerOptions) => {
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
    new PathLayer<RenderableFlightTrackRun>({
      ...sharedPathOptions,
      id: 'track-path-layer',
      extensions,
      data: style === 'standard' ? data.solidRuns : [],
      getPath: (track) => track.displayPath,
      getColor: getStandardColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: standardColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableFlightTrackRun>({
      ...sharedPathOptions,
      id: 'ground-track-casing-layer',
      extensions,
      data: style === 'altitude' ? data.groundRuns : [],
      getPath: (run) => run.displayPath,
      getColor: getGroundCasingColor,
      getWidth: (run) => getWidth(run) + 2.5,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableFlightTrackRun>({
      ...sharedPathOptions,
      id: 'altitude-track-path-layer',
      extensions,
      data: style === 'altitude' ? data.solidRuns : [],
      getPath: (run) => run.displayPath,
      getColor: getAltitudeColor,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableFlightTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-underlay-layer',
      extensions,
      data: data.estimatedRuns,
      getPath: (run) => run.displayPath,
      getColor: getEstimatedUnderlayColor,
      getWidth: (run) => getWidth(run) * ESTIMATED_UNDERLAY_WIDTH_SCALE,
      widthMinPixels: 1,
      capRounded: true,
      updateTriggers: {
        ...sharedPathOptions.updateTriggers,
        getColor: altitudeColorUpdateTriggers,
      },
    }),
    new PathLayer<RenderableFlightTrackRun>({
      ...sharedPathOptions,
      id: 'estimated-track-path-layer',
      extensions: [...extensions, estimatedPathStyle],
      data: data.estimatedRuns,
      getPath: (run) => run.displayPath,
      getColor: style === 'standard' ? getStandardColor : getAltitudeColor,
      getDashArray: (run: RenderableFlightTrackRun) => {
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
    } as PathLayerProps<RenderableFlightTrackRun> & {
      getDashArray: (run: RenderableFlightTrackRun) => [number, number];
    }),
    new PathLayer<RenderableFlightTrackPath>({
      id: 'ghost-track-path',
      parameters,
      extensions,
      data: data.paths,
      getPath: (track) => track.displayPath,
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
