import type { Route } from '$lib/components/flight-filters/types';
import type { FlightTrackCoordinate, FlightTrackRow } from '$lib/track/schema';
import type { prepareFlightArcData, FlightData } from '$lib/utils';
import greatCircle from '@turf/great-circle';
import { point } from '@turf/helpers';

export type FlightArc = ReturnType<typeof prepareFlightArcData>[number];

export type FlightTrackPath = FlightArc & {
  flightId: number;
  path: FlightTrackCoordinate[];
  ground?: boolean[];
  estimated?: boolean[];
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

  const interpolatedPath: FlightTrackCoordinate[] = [path[0]!];
  const maxDegrees = 3;

  for (let i = 1; i < path.length; i++) {
    const prev = interpolatedPath[interpolatedPath.length - 1]!;
    const curr = path[i]!;

    const dLon = Math.abs(curr[0] - prev[0]);
    const dLat = Math.abs(curr[1] - prev[1]);

    if (dLon > maxDegrees || dLat > maxDegrees) {
      try {
        const startPoint = point([prev[0], prev[1]]);
        const endPoint = point([curr[0], curr[1]]);

        const arc = greatCircle(startPoint, endPoint, { npoints: 20 });
        let arcCoords: [number, number][] = [];

        if (arc.geometry.type === 'MultiLineString') {
          arcCoords = arc.geometry.coordinates.flat() as [number, number][];
        } else {
          arcCoords = arc.geometry.coordinates as [number, number][];
        }
        const interpolatedArcCoords = arcCoords.slice(1).map((coord) => {
          return prev[2] !== undefined ? [coord[0], coord[1], prev[2]] : coord;
        }) as FlightTrackCoordinate[];

        interpolatedPath.push(...interpolatedArcCoords);
      } catch (error) {
        interpolatedPath.push(curr);
      }
    } else {
      interpolatedPath.push(curr);
    }
  }

  const unwrapped: FlightTrackCoordinate[] = [interpolatedPath[0]!];

  for (let index = 1; index < interpolatedPath.length; index++) {
    const previous = unwrapped[index - 1]!;
    const current = interpolatedPath[index]!;
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
      ground: track.ground,
      estimated: track.estimated,
    });
  }

  return paths;
};
