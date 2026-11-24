import {
  routeMatchesEndpoints,
  type Route,
} from '$lib/components/flight-filters/types';
import {
  toFlightTrackSamples,
  type FlightTrackRow,
  type FlightTrackSample,
} from '$lib/track/schema';
import type { prepareFlightArcData, FlightData } from '$lib/utils';

import type { FitShape } from './fit-geometry';

export type FlightArc = ReturnType<typeof prepareFlightArcData>[number];

export type FlightTrackIdentity = FlightArc & {
  flightId: number;
};

export type FlightTrackPath = FlightTrackIdentity & {
  samples: FlightTrackSample[];
};

export const getRouteKey = (fromId: number, toId: number) =>
  fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;

export const routeMatchesArc = (
  arc: FlightArc,
  route: Route | null | undefined,
) => {
  return routeMatchesEndpoints(arc.from.id, arc.to.id, route);
};

export const buildArcFrequencyPercentileByRoute = (flightArcs: FlightArc[]) => {
  const percentileByRoute: Record<string, number> = {};
  if (flightArcs.length === 0) return percentileByRoute;

  const frequencies = [...new Set(flightArcs.map((arc) => arc.frequency))].sort(
    (a, b) => a - b,
  );
  if (frequencies.length === 1) {
    for (const arc of flightArcs) {
      percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] = 0;
    }
    return percentileByRoute;
  }

  const denominator = frequencies.length - 1;
  const percentileByFrequency = new Map<number, number>();

  for (const [rank, frequency] of frequencies.entries()) {
    percentileByFrequency.set(frequency, rank / denominator);
  }

  for (const arc of flightArcs) {
    percentileByRoute[getRouteKey(arc.from.id, arc.to.id)] =
      percentileByFrequency.get(arc.frequency) ?? 0;
  }

  return percentileByRoute;
};

export const findFullyTrackedRouteKeys = (
  flightArcs: FlightArc[],
  trackFlightIds: Set<number>,
) => {
  const keys = new Set<string>();
  for (const arc of flightArcs) {
    if (
      arc.flights.length > 0 &&
      arc.flights.every((flight) => trackFlightIds.has(flight.id))
    ) {
      keys.add(getRouteKey(arc.from.id, arc.to.id));
    }
  }
  return keys;
};

export const hasFallbackFlightArcs = (
  flightArcs: FlightArc[],
  trackFlightIds: Set<number>,
) => {
  const fullyTrackedRouteKeys = findFullyTrackedRouteKeys(
    flightArcs,
    trackFlightIds,
  );
  return flightArcs.some(
    (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
  );
};

/*
 * Which of the given flights' tracks are drawn, and which routes still need
 * their great-circle arc because at least one of their flights has no drawn
 * track.
 */
export const selectDrawnRoutes = (
  flights: FlightData[],
  flightArcs: FlightArc[],
  flightTracks: FlightTrackRow[],
  drawsTrack: (flight: FlightData) => boolean,
) => {
  const flightById = new Map(flights.map((flight) => [flight.id, flight]));
  const tracks = flightTracks.filter((track) => {
    const flight = flightById.get(track.flightId);
    return flight !== undefined && drawsTrack(flight);
  });
  const fullyTrackedRouteKeys = findFullyTrackedRouteKeys(
    flightArcs,
    new Set(tracks.map((track) => track.flightId)),
  );
  const arcs = flightArcs.filter(
    (arc) => !fullyTrackedRouteKeys.has(getRouteKey(arc.from.id, arc.to.id)),
  );
  return { tracks, arcs, flightById };
};

export const buildFitShape = (
  flights: FlightData[],
  flightArcs: FlightArc[],
  flightTracks: FlightTrackRow[],
  drawsTrack: (flight: FlightData) => boolean,
): FitShape => {
  const drawn = selectDrawnRoutes(
    flights,
    flightArcs,
    flightTracks,
    drawsTrack,
  );
  // Like `buildFlightTrackPaths`, skip tracks whose route has no arc, which
  // the layer does not draw either.
  const routeKeys = new Set(
    flightArcs.map((arc) => getRouteKey(arc.from.id, arc.to.id)),
  );
  return {
    arcs: drawn.arcs,
    tracks: drawn.tracks.flatMap((track) => {
      const flight = drawn.flightById.get(track.flightId);
      return flight?.from &&
        flight.to &&
        routeKeys.has(getRouteKey(flight.from.id, flight.to.id))
        ? [
            {
              route: { from: flight.from, to: flight.to },
              path: track.coordinates,
            },
          ]
        : [];
    }),
  };
};

export const buildFlightTrackPaths = (
  flights: FlightData[],
  flightArcs: FlightArc[],
  flightTracks: FlightTrackRow[],
) => {
  const paths: FlightTrackPath[] = [];
  const flightById = new Map(flights.map((flight) => [flight.id, flight]));
  const arcByRoute = new Map(
    flightArcs.map((arc) => [getRouteKey(arc.from.id, arc.to.id), arc]),
  );

  for (const track of flightTracks) {
    const flight = flightById.get(track.flightId);
    if (!flight?.from || !flight.to) continue;

    const arc = arcByRoute.get(getRouteKey(flight.from.id, flight.to.id));
    if (!arc) continue;

    paths.push({
      ...arc,
      flightId: track.flightId,
      samples: toFlightTrackSamples(track),
    });
  }

  return paths;
};
