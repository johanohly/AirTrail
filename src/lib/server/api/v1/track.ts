import { db } from '$lib/db';
import {
  deleteFlightTrackPrimitiveWithConnection,
  upsertFlightTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import {
  flightTrackPayloadSchema,
  type FlightTrackInput,
} from '$lib/track/schema';
import type { ApiPrincipal } from './principal';
import { requireApiScope, requireFlightScope } from './access';

const authorize = async (
  principal: ApiPrincipal,
  flightId: number,
  write: boolean,
) => {
  await requireFlightScope(principal, write ? 'update' : 'read', flightId);
  requireApiScope(principal, write ? 'tracks.write' : 'tracks.read');
};

/*
 * The read-back after a write deliberately does not re-check read scopes: the
 * write was already authorized, and a credential holding `tracks.write` without
 * `tracks.read` must not get a 403 for an operation that committed.
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

export const getApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await authorize(principal, flightId, false);
  return readTrack(flightId);
};

export const setApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
  track: FlightTrackInput,
) => {
  await authorize(principal, flightId, true);
  await upsertFlightTrackPrimitiveWithConnection(db, flightId, track);
  return readTrack(flightId);
};

export const deleteApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await authorize(principal, flightId, true);
  await deleteFlightTrackPrimitiveWithConnection(db, flightId);
};
