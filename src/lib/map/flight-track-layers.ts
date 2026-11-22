import type { Color, LayerExtension } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { PathLayer, type PathLayerProps } from '@deck.gl/layers';

import type {
  FlightArc,
  FlightTrackIdentity,
  FlightTrackPath,
} from './flight-layer-data';
import {
  appendDisplayPoint,
  findSharedDepthCeiling,
  MAX_FLIGHT_TRACK_DISPLAY_POINTS,
  prepareFlightTrackDisplaySegments,
} from './flight-track-display-geometry';
import {
  flightTrackStylesMatch,
  getFlightTrackAltitudeSections,
  getFlightTrackEdgeStyle,
  type FlightTrackEdgeStyle,
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
  skippedTracks: FlightTrackDisplayFailure[];
};

export type FlightTrackDisplayFailure = {
  flightId: number;
  originalPointCount: number;
  reducedPointCount: number;
  requiredPoints: number;
  pointLimit: number;
};

export const formatFlightTrackDisplayWarning = (
  failure: FlightTrackDisplayFailure,
  flightNumber?: string | null,
  flightDate?: string | null,
) => {
  // The flight ID is also the track's primary key.
  const identity = [flightDate, `track ID: ${failure.flightId}`]
    .filter(Boolean)
    .join(', ');
  const flight = flightNumber ? `flight ${flightNumber}` : 'flight';
  const count = (value: number) => value.toLocaleString();
  return `Unable to render ${flight} (${identity}). The required display geometry contains ${count(failure.requiredPoints)} points, exceeding the ${count(failure.pointLimit)}-point limit. The track has ${count(failure.originalPointCount)} original and ${count(failure.reducedPointCount)} retained points. Your stored flight data has not been modified. Please report this issue to the AirTrail community with the flight and track identifiers.`;
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
    wrapLongitude: boolean;
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

const prepareTrackEdges = (path: FlightTrackPath, splitByAltitude: boolean) => {
  let requiredPoints = 1; // The start of the picking path.
  let previousStyle: FlightTrackEdgeStyle | undefined;
  const segments = prepareFlightTrackDisplaySegments(
    path.samples.map((sample) => sample.coordinate),
  );
  const edges = segments.map((segment, index) => {
    const start = path.samples[index]!;
    const end = path.samples[index + 1]!;
    const style = getFlightTrackEdgeStyle(start, end, splitByAltitude);
    const sections = getFlightTrackAltitudeSections(
      start.coordinate[2],
      segment.coincident ? undefined : end.coordinate[2],
      style,
    );
    const visibleLayerCount =
      (style.estimated ? 2 : 1) + (style.ground ? 1 : 0);
    const layerCount = visibleLayerCount + 1; // Include the picking layer.
    const firstStyle = { ...style, altitudeFeet: sections.altitudeAt(0) };

    // Each section adds one endpoint per layer. Each new style run also
    // repeats its start in its visible layers.
    requiredPoints += sections.count * layerCount;
    requiredPoints += (sections.count - 1) * visibleLayerCount;
    if (!previousStyle || !flightTrackStylesMatch(previousStyle, firstStyle)) {
      requiredPoints += visibleLayerCount;
    }
    previousStyle = {
      ...style,
      altitudeFeet: sections.altitudeAt(sections.count - 1),
    };
    return { ...segment, sections, style, layerCount };
  });
  return { edges, requiredPoints };
};

export const prepareFlightTrackLayerData = (
  paths: FlightTrackPath[],
  style: FlightTrackStyle,
): FlightTrackLayerData => {
  const preparedPaths: RenderableFlightTrackPath[] = [];
  const preparedRuns: RenderableFlightTrackRun[] = [];
  const skippedTracks: FlightTrackDisplayFailure[] = [];

  for (const path of paths) {
    if (path.samples.length < 2) continue;
    const { edges, requiredPoints } = prepareTrackEdges(
      path,
      style === 'altitude',
    );
    if (requiredPoints > MAX_FLIGHT_TRACK_DISPLAY_POINTS) {
      skippedTracks.push({
        flightId: path.flightId,
        originalPointCount: path.originalPointCount,
        reducedPointCount: path.samples.length,
        requiredPoints,
        pointLimit: MAX_FLIGHT_TRACK_DISPLAY_POINTS,
      });
      continue;
    }

    const ceiling = findSharedDepthCeiling(requiredPoints, edges);
    const { samples, originalPointCount, ...identity } = path;
    const [lon, lat] = samples[0]!.coordinate;
    const displayPath: [number, number][] = [[lon, lat]];
    let run: RenderableFlightTrackRun | undefined;
    for (const edge of edges) {
      const { sections, coordinateAt } = edge;
      const divisions = 2 ** Math.min(edge.subdivisionDepth, ceiling);
      let nextSubdivision = 1;
      for (let index = 0; index < sections.count; index++) {
        const sectionStyle = {
          ...edge.style,
          altitudeFeet: sections.altitudeAt(index),
        };
        if (!run || !flightTrackStylesMatch(run, sectionStyle)) {
          run = {
            ...identity,
            ...sectionStyle,
            displayPath: [displayPath.at(-1)!],
          };
          preparedRuns.push(run);
        }

        const end = sections.endProgress(index);
        while (nextSubdivision / divisions < end) {
          run.displayPath.push(
            appendDisplayPoint(
              displayPath,
              coordinateAt(nextSubdivision / divisions),
            ),
          );
          nextSubdivision++;
        }
        if (nextSubdivision / divisions === end) nextSubdivision++;
        run.displayPath.push(
          appendDisplayPoint(displayPath, coordinateAt(end)),
        );
      }
    }
    preparedPaths.push({ ...path, displayPath });
  }

  return {
    paths: preparedPaths,
    solidRuns: preparedRuns.filter((run) => !run.estimated),
    estimatedRuns: preparedRuns.filter((run) => run.estimated),
    groundRuns: preparedRuns.filter((run) => run.ground),
    skippedTracks,
  };
};

export const buildFlightTrackLayers = ({
  data,
  style,
  context: {
    geometry: { parameters, extensions, wrapLongitude },
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
    wrapLongitude,
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
      wrapLongitude,
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
