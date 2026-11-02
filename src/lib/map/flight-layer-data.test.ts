import { describe, expect, it } from 'vitest';

import {
  buildFlightTrackPaths,
  collectAirportRouteArcs,
  hasFallbackFlightArcs,
  type FlightArc,
} from './flight-layer-data';

import type { FlightTrackRow } from '$lib/track/schema';
import type { FlightData } from '$lib/utils';

describe('flight track layer data', () => {
  it('preserves canonical source coordinates in render paths', () => {
    const flights = [{ id: 7, from: { id: 1 }, to: { id: 2 } }] as FlightData[];
    const arcs = [{ from: { id: 1 }, to: { id: 2 } }] as FlightArc[];
    const coordinates = [
      [179, 55, 1_000],
      [-179, 56, 2_000],
      [-178, 57],
    ] as FlightTrackRow['coordinates'];
    const tracks = [{ flightId: 7, coordinates }] as FlightTrackRow[];

    const paths = buildFlightTrackPaths(flights, arcs, tracks);

    expect(paths[0]!.samples.map((sample) => sample.coordinate)).toEqual(
      coordinates,
    );
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
        samples: [
          {
            coordinate: [10, 55, 0],
            point: { ground: true },
            incomingEdge: { estimated: false },
          },
          {
            coordinate: [11, 56, 304.8],
            point: { ground: false },
            incomingEdge: { estimated: true },
          },
        ],
      },
    ]);
    expect(paths[0]!.samples).toHaveLength(2);
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

describe('collectAirportRouteArcs', () => {
  it('collects arcs for routes departing and arriving at the airport', () => {
    const flights = [
      { id: 1, from: { id: 1 }, to: { id: 2 } },
      { id: 2, from: { id: 3 }, to: { id: 1 } },
      { id: 3, from: { id: 2 }, to: { id: 3 } },
    ] as FlightData[];

    const arcs = collectAirportRouteArcs(flights, 1);

    expect(arcs).toContainEqual({
      from: { id: 1 },
      to: { id: 2 },
      frequency: 1,
    });
    expect(arcs).toContainEqual({
      from: { id: 3 },
      to: { id: 1 },
      frequency: 1,
    });
    expect(arcs).toHaveLength(2);
  });

  it('merges repeated and reversed flights of a route into one arc', () => {
    const outbound = { id: 4, from: { id: 1 }, to: { id: 2 } };
    const flights = [
      outbound,
      { id: 5, from: { id: 2 }, to: { id: 1 } },
      { id: 6, from: { id: 1 }, to: { id: 2 } },
    ] as FlightData[];

    const arcs = collectAirportRouteArcs(flights, 1);

    expect(arcs).toEqual([{ from: { id: 1 }, to: { id: 2 }, frequency: 3 }]);
    expect(arcs[0]!.from).toBe(outbound.from);
    expect(arcs[0]!.to).toBe(outbound.to);
  });

  it('skips flights missing an endpoint', () => {
    const flights = [
      { id: 7, from: null, to: { id: 1 } },
      { id: 8, from: { id: 1 }, to: null },
      { id: 9, from: { id: 1 }, to: { id: 2 } },
    ] as FlightData[];

    expect(collectAirportRouteArcs(flights, 1)).toEqual([
      { from: { id: 1 }, to: { id: 2 }, frequency: 1 },
    ]);
  });

  it('returns no arcs when no flight touches the airport', () => {
    const flights = [
      { id: 10, from: { id: 2 }, to: { id: 3 } },
      { id: 11, from: { id: 3 }, to: { id: 4 } },
    ] as FlightData[];

    expect(collectAirportRouteArcs(flights, 1)).toEqual([]);
  });
});
