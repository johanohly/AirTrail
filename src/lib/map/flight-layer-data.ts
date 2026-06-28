import type { Route } from '$lib/components/flight-filters/types';
import type { FlightTrackCoordinate, FlightTrackRow } from '$lib/track/schema';
import type { prepareFlightArcData, FlightData } from '$lib/utils';

export type FlightArc = ReturnType<typeof prepareFlightArcData>[number];

export type FlightTrackPath = FlightArc & {
  flightId: number;
  path: FlightTrackCoordinate[];
};

export const getRouteKey = (fromId: number, toId: number) =>
  fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;

export const routeMatchesArc = (
  arc: FlightArc,
  route: Route | null | undefined,
) => {
  if (!route) return false;
  const fromId = arc.from.id.toString();
  const toId = arc.to.id.toString();
  return (
    (fromId === route.a && toId === route.b) ||
    (fromId === route.b && toId === route.a)
  );
};

export const unwrapTrackPath = (path: FlightTrackCoordinate[]) => {
  if (!path.length) return path;
  const unwrapped: FlightTrackCoordinate[] = [path[0]!];

  for (let index = 1; index < path.length; index++) {
    const previous = unwrapped[index - 1]!;
    const current = path[index]!;
    let lon = current[0];
    while (lon - previous[0] > 180) lon -= 360;
    while (lon - previous[0] < -180) lon += 360;
    unwrapped.push(
      current[2] === undefined
        ? [lon, current[1]]
        : [lon, current[1], current[2]],
    );
  }

  return unwrapped;
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
      path: unwrapTrackPath(track.coordinates),
    });
  }

  return paths;
};
