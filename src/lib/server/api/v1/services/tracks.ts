import { db } from '$lib/db';
import {
  deleteFlightTrackPrimitiveWithConnection,
  upsertFlightTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import {
  flightTrackPayloadSchema,
  type FlightTrackInput,
} from '$lib/track/schema';
import { requireFlightScope } from '../access';
import type { ApiPrincipal } from '../principal';

/*
 * Not re-checked against read scopes after a write: a credential holding
 * `tracks.write` without `tracks.read` must not get a 403 for an operation
 * that committed.
 */
const readTrack = async (flightId: number) => {
  const row = await db
    .selectFrom('flightTrack')
    .selectAll()
    .where('flightId', '=', flightId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    flightId,
    ...flightTrackPayloadSchema.parse(row.track),
    sourceFormat: row.sourceFormat,
    sourceName: row.sourceName,
    pointCount: row.pointCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
};

export const getFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await requireFlightScope(principal, 'read', flightId);
  return readTrack(flightId);
};

export const setFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
  track: FlightTrackInput,
) => {
  await requireFlightScope(principal, 'update', flightId);
  await upsertFlightTrackPrimitiveWithConnection(db, flightId, track);
  return readTrack(flightId);
};

export const deleteFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await requireFlightScope(principal, 'update', flightId);
  await deleteFlightTrackPrimitiveWithConnection(db, flightId);
};
