import { describe, expect, it } from 'vitest';

import type { FlightTrackPath } from './flight-layer-data';
import {
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
  },
] as FlightTrackPath[];

describe('flight track layers', () => {
  it('only prepares altitude runs when the altitude style is active', () => {
    expect(prepareFlightTrackLayerData(paths, 'standard')).toEqual({
      paths,
      solidRuns: [],
      estimatedRuns: [],
    });

    const altitudeData = prepareFlightTrackLayerData(paths, 'altitude');
    expect(altitudeData.solidRuns).toHaveLength(1);
    expect(altitudeData.estimatedRuns).toHaveLength(1);
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
      widthUpdateTriggers: [],
      standardColorUpdateTriggers: [],
      altitudeColorUpdateTriggers: [],
      onHover: undefined,
      onClick: undefined,
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      'track-path-layer',
      'altitude-track-path-layer',
      'estimated-track-underlay-layer',
      'estimated-track-path-layer',
      'ghost-track-path',
    ]);
    expect(layers[0]!.props.data).toEqual([]);
    expect(layers[1]!.props.data).toBe(data.solidRuns);
    expect(layers[2]!.props.data).toBe(data.estimatedRuns);
    expect(layers[4]!.props.data).toBe(paths);
  });
});
