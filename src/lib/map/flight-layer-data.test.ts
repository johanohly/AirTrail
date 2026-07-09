import { describe, expect, it } from 'vitest';

import {
  buildFlightTrackPaths,
  type FlightArc,
  unwrapTrackPath,
} from './flight-layer-data';

import type { FlightTrackRow } from '$lib/track/schema';
import type { FlightData } from '$lib/utils';

describe('flight track layer data', () => {
  it('unwraps dateline crossings without dropping altitude', () => {
    expect(
      unwrapTrackPath([
        [179, 55, 1_000],
        [-179, 56, 2_000],
        [-178, 57],
      ]),
    ).toEqual([
      [179, 55, 1_000],
      [181, 56, 2_000],
      [182, 57],
    ]);
  });

  it('carries aligned flags into render paths', () => {
    const flights = [{ id: 7, from: { id: 1 }, to: { id: 2 } }] as FlightData[];
    const arcs = [{ from: { id: 1 }, to: { id: 2 } }] as FlightArc[];
    const tracks = [
      {
        flightId: 7,
        coordinates: [
          [10, 55, 0],
          [11, 56, 304.8],
        ],
        ground: [true, false],
        estimated: [false, true],
        sourceFormat: 'kml',
        pointCount: 2,
      },
    ] as FlightTrackRow[];

    expect(buildFlightTrackPaths(flights, arcs, tracks)).toMatchObject([
      {
        flightId: 7,
        path: [
          [10, 55, 0],
          [11, 56, 304.8],
        ],
        ground: [true, false],
        estimated: [false, true],
      },
    ]);
  });
});
