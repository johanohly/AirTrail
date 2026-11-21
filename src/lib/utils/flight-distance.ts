import { distanceBetween } from './distance';

/** Once around the Earth, a generous limit for a distance entered by hand. */
export const MAX_MANUAL_DISTANCE_KM = 40_075;

export type FlightDistanceSource = 'manual' | 'track' | 'great-circle';

export type FlightDistance = {
  km: number;
  source: FlightDistanceSource;
};

type DistanceAirport = { lat: number; lon: number };

type DistanceInput = {
  from: DistanceAirport | null;
  to: DistanceAirport | null;
  manualDistance: number | null;
  trackDistance: number | null;
};

/*
 * A measured track only replaces the great-circle distance when the two agree
 * roughly. Real FR24 tracks run 2-25% longer than the great circle (holding,
 * airspace detours), so the upper bound leaves room for long holds and
 * diversions while catching the hundreds of kilometres a spoofed position adds.
 * A track much shorter than the route is missing its start or end. A flight
 * back to where it started has no route length to compare with, so its track
 * is taken as it is.
 */
const SAME_AIRPORT_KM = 1;
const MIN_TRACK_RATIO = 0.9;
const MAX_TRACK_RATIO = 1.5;
const MAX_TRACK_EXTRA_KM = 1_000;

export const greatCircleDistance = (
  from: DistanceAirport | null,
  to: DistanceAirport | null,
): number | null =>
  from && to
    ? distanceBetween([from.lon, from.lat], [to.lon, to.lat]) / 1000
    : null;

export const isPlausibleTrackDistance = (
  trackKm: number,
  greatCircleKm: number,
) =>
  greatCircleKm < SAME_AIRPORT_KM ||
  (trackKm >= greatCircleKm * MIN_TRACK_RATIO &&
    trackKm <= greatCircleKm * MAX_TRACK_RATIO + MAX_TRACK_EXTRA_KM);

/** The distance every view shows and sums for a flight, in km. */
export const resolveFlightDistance = (
  flight: DistanceInput,
): FlightDistance | null => {
  if (typeof flight.manualDistance === 'number') {
    return { km: flight.manualDistance, source: 'manual' };
  }

  const greatCircleKm = greatCircleDistance(flight.from, flight.to);
  if (greatCircleKm === null) return null;

  if (
    typeof flight.trackDistance === 'number' &&
    isPlausibleTrackDistance(flight.trackDistance, greatCircleKm)
  ) {
    return { km: flight.trackDistance, source: 'track' };
  }

  return { km: greatCircleKm, source: 'great-circle' };
};
