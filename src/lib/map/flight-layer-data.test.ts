import { describe, expect, it } from 'vitest';

import {
  buildFitShape,
  buildFlightTrackPaths,
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
    const tracks = [
      { flightId: 7, coordinates, pointCount: 45 },
    ] as FlightTrackRow[];

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

  it('fits drawn tracks in place of the arcs they replace', () => {
    const cph = { id: 1, lat: 55.6, lon: 12.6 };
    const msp = { id: 2, lat: 44.9, lon: -93.2 };
    const lhr = { id: 3, lat: 51.5, lon: -0.5 };
    const flights = [
      { id: 7, from: cph, to: msp },
      { id: 8, from: cph, to: lhr },
      { id: 9, from: cph, to: lhr },
      { id: 10, from: lhr, to: msp },
    ] as FlightData[];
    const arcs = [
      { from: cph, to: msp, flights: [{ id: 7 }] },
      { from: cph, to: lhr, flights: [{ id: 8 }, { id: 9 }] },
      { from: lhr, to: msp, flights: [{ id: 10 }] },
    ] as FlightArc[];
    const coordinates = [
      [12.6, 55.6],
      [-40, 71],
      [-93.2, 44.9],
    ] as FlightTrackRow['coordinates'];
    const tracks = [
      { flightId: 7, coordinates },
      { flightId: 8, coordinates },
      { flightId: 10, coordinates },
    ] as FlightTrackRow[];

    const shape = buildFitShape(
      flights,
      arcs,
      tracks,
      (flight) => flight.id !== 10,
    );

    // CPH-MSP is fully tracked, so only its track counts. CPH-LHR still
    // draws its arc for flight 9, and flight 10 shows points, not its track.
    expect(shape.arcs).toEqual([arcs[1], arcs[2]]);
    expect(shape.tracks).toEqual([
      { route: { from: cph, to: msp }, path: coordinates },
      { route: { from: cph, to: lhr }, path: coordinates },
    ]);
  });
});
