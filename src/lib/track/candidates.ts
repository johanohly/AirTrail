import type { ParsedTrackCandidate } from './parser';

type Location = { lat: number; lon: number };

type TrackCandidateMatchContext = {
  from: Location | null | undefined;
  to: Location | null | undefined;
  maxAirportDistanceMeters?: number;
};

const distanceMeters = (coordinate: readonly number[], airport: Location) => {
  const toRadians = Math.PI / 180;
  const deltaLat = (airport.lat - coordinate[1]!) * toRadians;
  const deltaLon = (airport.lon - coordinate[0]!) * toRadians;
  const startLat = coordinate[1]! * toRadians;
  const endLat = airport.lat * toRadians;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
};

export const findAutomaticTrackCandidate = (
  candidates: ParsedTrackCandidate[],
  { from, to, maxAirportDistanceMeters = 75_000 }: TrackCandidateMatchContext,
): ParsedTrackCandidate | null => {
  if (candidates.length === 1) return candidates[0]!;
  if (!from || !to) return null;

  const routeMatches = candidates.filter(
    (candidate) =>
      distanceMeters(candidate.startCoordinate, from) <=
        maxAirportDistanceMeters &&
      distanceMeters(candidate.endCoordinate, to) <= maxAirportDistanceMeters,
  );
  if (routeMatches.length === 1) return routeMatches[0]!;
  return null;
};
