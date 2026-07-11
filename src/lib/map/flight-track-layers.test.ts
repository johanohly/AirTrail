import { describe, expect, it } from 'vitest';
import { distance, point } from '@turf/turf';

import type { FlightTrackPath } from './flight-layer-data';
import {
  buildFlightTrackDisplayPath,
  buildFlightTrackLayers,
  prepareFlightTrackLayerData,
} from './flight-track-layers';

const paths = [
  {
    flightId: 1,
    path: [
      [10, 55, 0],
      [11, 56, 304.8],
      [12, 57, 609.6],
    ],
    estimated: [false, false, true],
    ground: [true, false, false],
  },
] as FlightTrackPath[];

describe('flight track layers', () => {
  it('adaptively follows the globe without changing source coordinates', () => {
    const source = [
      [0, 0, 100],
      [179, 0, 1_000],
    ] as FlightTrackPath['path'];

    const display = buildFlightTrackDisplayPath(source);

    expect(display).toHaveLength(2_049);
    expect(display[0]).toEqual([0, 0]);
    expect(display.at(-1)).toEqual([179, 0]);
    expect(source).toEqual([
      [0, 0, 100],
      [179, 0, 1_000],
    ]);
    for (let index = 1; index < display.length; index++) {
      expect(
        distance(point(display[index - 1]!), point(display[index]!), {
          units: 'meters',
        }),
      ).toBeLessThanOrEqual(19_000.001);
    }
  });

  it('keeps generated antimeridian geometry continuous', () => {
    const display = buildFlightTrackDisplayPath([
      [170, 10],
      [190, 10],
    ]);

    expect(display[0]).toEqual([170, 10]);
    expect(display.at(-1)).toEqual([190, 10]);
    for (let index = 1; index < display.length; index++) {
      expect(
        distance(point(display[index - 1]!), point(display[index]!), {
          units: 'meters',
        }),
      ).toBeLessThanOrEqual(19_000.001);
    }
  });

  it('uses tar1090 distance thresholds and power-of-two subdivision', () => {
    expect(
      buildFlightTrackDisplayPath([
        [0, 0],
        [0.2, 0],
      ]),
    ).toHaveLength(2);
    expect(
      buildFlightTrackDisplayPath([
        [0, 0],
        [0.4, 0],
      ]),
    ).toHaveLength(5);
  });

  it('prepares estimated runs for every track style', () => {
    const standardData = prepareFlightTrackLayerData(paths, 'standard');
    expect(standardData.solidRuns).toHaveLength(1);
    expect(standardData.estimatedRuns).toHaveLength(1);
    expect(standardData.groundRuns).toHaveLength(0);
    expect(standardData.solidRuns[0]).toMatchObject({
      altitudeFeet: null,
      estimated: false,
    });

    const altitudeData = prepareFlightTrackLayerData(paths, 'altitude');
    expect(altitudeData.solidRuns).toHaveLength(1);
    expect(altitudeData.estimatedRuns).toHaveLength(1);
    expect(altitudeData.groundRuns).toHaveLength(1);
  });

  it('renders estimated standard segments through the dotted layers', () => {
    const data = prepareFlightTrackLayerData(paths, 'standard');
    const layers = buildFlightTrackLayers({
      data,
      style: 'standard',
      parameters: {},
      extensions: [],
      getWidth: () => 2,
      getStandardColor: () => [1, 2, 3],
      getAltitudeColor: () => [4, 5, 6],
      getGroundCasingColor: () => [9, 9, 11, 220],
      getEstimatedUnderlayColor: () => [24, 24, 27, 190],
      widthUpdateTriggers: [],
      standardColorUpdateTriggers: [],
      altitudeColorUpdateTriggers: [],
      onHover: undefined,
      onClick: undefined,
    });

    expect(layers[0]!.props.data).toBe(data.solidRuns);
    expect(layers[1]!.props.data).toEqual([]);
    expect(layers[2]!.props.data).toEqual([]);
    expect(layers[3]!.props.data).toBe(data.estimatedRuns);
    expect(layers[4]!.props.data).toBe(data.estimatedRuns);
    expect(layers[3]!.props.getWidth(data.estimatedRuns[0])).toBeCloseTo(1.12);
    expect(layers[3]!.props.widthMinPixels).toBe(1);
    expect(layers[3]!.props.capRounded).toBe(true);
    expect(layers[4]!.props.capRounded).toBe(true);
    expect(layers[4]!.props.getWidth(data.estimatedRuns[0])).toBe(2);
    const dashArray = layers[4]!.props.getDashArray(data.estimatedRuns[0]);
    expect(dashArray).toEqual([10, 23]);
    expect(
      layers[4]!.props.getColor(data.estimatedRuns[0], {
        index: 0,
        data: data.estimatedRuns,
        target: [],
      }),
    ).toEqual([1, 2, 3]);
  });

  it('owns the complete ordered flight-track layer stack', () => {
    const data = prepareFlightTrackLayerData(paths, 'altitude');
    const layers = buildFlightTrackLayers({
      data,
      style: 'altitude',
      parameters: {},
      extensions: [],
      getWidth: () => 2,
      getStandardColor: () => [0, 0, 0],
      getAltitudeColor: () => [0, 0, 0],
      getGroundCasingColor: () => [9, 9, 11, 220],
      getEstimatedUnderlayColor: () => [24, 24, 27, 190],
      widthUpdateTriggers: [],
      standardColorUpdateTriggers: [],
      altitudeColorUpdateTriggers: [],
      onHover: undefined,
      onClick: undefined,
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      'track-path-layer',
      'ground-track-casing-layer',
      'altitude-track-path-layer',
      'estimated-track-underlay-layer',
      'estimated-track-path-layer',
      'ghost-track-path',
    ]);
    expect(layers[0]!.props.data).toEqual([]);
    expect(layers[1]!.props.data).toBe(data.groundRuns);
    expect(layers[1]!.props.getWidth(data.groundRuns[0])).toBe(4.5);
    expect(layers[2]!.props.data).toBe(data.solidRuns);
    expect(layers[3]!.props.data).toBe(data.estimatedRuns);
    expect(layers[5]!.props.data).toBe(paths);
  });

  it('renders tracks on the map surface while retaining stored altitude', () => {
    const data = prepareFlightTrackLayerData(paths, 'altitude');
    const layers = buildFlightTrackLayers({
      data,
      style: 'altitude',
      parameters: {},
      extensions: [],
      getWidth: () => 2,
      getStandardColor: () => [0, 0, 0],
      getAltitudeColor: () => [0, 0, 0],
      getGroundCasingColor: () => [9, 9, 11, 220],
      getEstimatedUnderlayColor: () => [24, 24, 27, 60],
      widthUpdateTriggers: [],
      standardColorUpdateTriggers: [],
      altitudeColorUpdateTriggers: [],
      onHover: undefined,
      onClick: undefined,
    });

    const visiblePath = layers[2]!.props.getPath(data.solidRuns[0], {
      index: 0,
      data: data.solidRuns,
      target: [],
    });
    const pickingPath = layers[5]!.props.getPath(paths[0], {
      index: 0,
      data: paths,
      target: [],
    });

    expect(visiblePath[0]).toEqual([10, 55]);
    expect(visiblePath.at(-1)).toEqual([11, 56]);
    expect(visiblePath).toHaveLength(9);
    expect(pickingPath[0]).toEqual([10, 55]);
    expect(pickingPath.at(-1)).toEqual([12, 57]);
    expect(pickingPath.every((coordinate) => coordinate.length === 2)).toBe(
      true,
    );
    expect(paths[0]!.path[1]).toEqual([11, 56, 304.8]);
    expect(
      layers[3]!.props.getColor(data.estimatedRuns[0], {
        index: 0,
        data: data.estimatedRuns,
        target: [],
      }),
    ).toEqual([24, 24, 27, 60]);
  });
});
