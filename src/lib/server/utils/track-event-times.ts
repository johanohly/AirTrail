import { db } from '$lib/db';
import { listFlightBaseQuery } from '$lib/db/queries';
import type { Flight } from '$lib/db/types';
import {
  fillFlightTimesFromTrackWithConnection,
  trackTimesToFill,
} from '$lib/server/utils/flight';
import {
  resolveStoredTrackEventTimes,
  type TrackEventSkipReason,
} from '$lib/track/event-times';
import {
  flightTrackPayloadSchema,
  type FlightTrackPayload,
} from '$lib/track/schema';

/** Tracks loaded at once; each can hold up to 100,000 points. */
const TRACK_BATCH_SIZE = 10;

export type TrackTimeFillReason =
  | TrackEventSkipReason
  | 'invalid-track'
  /** Filling it would put the landing before the takeoff. */
  | 'order';

export type TrackTimeFillSide = {
  /** The stored value, which is never overwritten. */
  current: string | null;
  detected: string | null;
  fill: boolean;
  reason: TrackTimeFillReason | null;
};

export type TrackTimeFill = {
  flight: Flight;
  takeoff: TrackTimeFillSide;
  landing: TrackTimeFillSide;
};

/** Flights whose track could fill something; the rest skip loading it. */
const canUseTrack = (flight: Flight) =>
  flight.datePrecision === 'day' && Boolean(flight.from?.tz || flight.to?.tz);

/*
 * Calls `visit` with each of the user's flights that has a saved track and an
 * empty takeoff or landing time, newest first. Tracks stay on the server and
 * are loaded a few at a time, so a large account never holds them all.
 */
const forEachTrackedFlight = async (
  userId: string,
  flightIds: number[] | null,
  visit: (flight: Flight, track: FlightTrackPayload | null) => Promise<void>,
) => {
  if (flightIds?.length === 0) return;
  let query = listFlightBaseQuery(db, userId)
    .where((eb) =>
      eb.or([
        eb('flight.takeoffActual', 'is', null),
        eb('flight.landingActual', 'is', null),
      ]),
    )
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('flightTrack')
          .select('flightTrack.flightId')
          .whereRef('flightTrack.flightId', '=', 'flight.id'),
      ),
    )
    .orderBy('flight.date', 'desc')
    .orderBy('flight.id', 'desc');
  if (flightIds) query = query.where('flight.id', 'in', flightIds);
  const flights = await query.execute();

  for (let i = 0; i < flights.length; i += TRACK_BATCH_SIZE) {
    const batch = flights.slice(i, i + TRACK_BATCH_SIZE);
    const ids = batch.filter(canUseTrack).map((flight) => flight.id);
    const rows = ids.length
      ? await db
          .selectFrom('flightTrack')
          .select(['flightId', 'track'])
          .where('flightId', 'in', ids)
          .execute()
      : [];
    const tracks = new Map(rows.map((row) => [row.flightId, row.track]));
    for (const flight of batch) {
      const parsed = flightTrackPayloadSchema.safeParse(tracks.get(flight.id));
      await visit(flight, parsed.success ? parsed.data : null);
    }
  }
};

const planFlight = (
  flight: Flight,
  track: FlightTrackPayload | null,
): TrackTimeFill => {
  const events = track && resolveStoredTrackEventTimes(track, flight);
  const fill = track ? trackTimesToFill(track, flight) : {};
  const skipped: TrackTimeFillReason | null =
    flight.datePrecision !== 'day'
      ? 'inexact-date'
      : !canUseTrack(flight)
        ? 'no-airport'
        : null;
  const side = (key: 'takeoffActual' | 'landingActual') => {
    const current = flight[key];
    const event = events?.[key];
    const fills = fill[key] !== undefined;
    let reason: TrackTimeFillReason | null = event ? event.reason : null;
    if (skipped) reason = skipped;
    else if (!event) reason = 'invalid-track';
    else if (!reason && !current && !fills) reason = 'order';
    return {
      current,
      detected: event?.at ? new Date(event.at.getTime()).toISOString() : null,
      fill: fills,
      reason,
    };
  };
  return {
    flight,
    takeoff: side('takeoffActual'),
    landing: side('landingActual'),
  };
};

export const planTrackTimeFills = async (userId: string) => {
  const plans: TrackTimeFill[] = [];
  await forEachTrackedFlight(userId, null, async (flight, track) => {
    plans.push(planFlight(flight, track));
  });
  return plans;
};

/**
 * Fill the selected flights' empty takeoff and landing times from their
 * tracks. Times are detected again here rather than taken from the client,
 * and a value set in the meantime is kept.
 */
export const fillTrackTimes = async (userId: string, flightIds: number[]) => {
  let filled = 0;
  await forEachTrackedFlight(userId, flightIds, async (flight, track) => {
    if (
      track &&
      (await fillFlightTimesFromTrackWithConnection(db, flight.id, track))
    )
      filled++;
  });
  return { filled };
};
