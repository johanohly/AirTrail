import { describe, expect, it } from 'vitest';

import {
  buildFlightTrackPaths,
  hasFallbackFlightArcs,
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

    const paths = buildFlightTrackPaths(flights, arcs, tracks);

    expect(paths).toMatchObject([
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
    expect(paths[0]!.path).toHaveLength(paths[0]!.estimated!.length);
  });

  it('detects whether route arcs remain after tracked flights are replaced', () => {
    const arcs = [
      {
        from: { id: 1 },
        to: { id: 2 },
        flights: [{ id: 7 }, { id: 8 }],
      },
    ] as FlightArc[];

    expect(hasFallbackFlightArcs(arcs, new Set([7]))).toBe(true);
    expect(hasFallbackFlightArcs(arcs, new Set([7, 8]))).toBe(false);
  });
});
