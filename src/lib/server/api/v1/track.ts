import { db } from '$lib/db';
import {
  deleteFlightTrackPrimitiveWithConnection,
  upsertFlightTrackPrimitiveWithConnection,
} from '$lib/db/queries';
import {
  flightTrackPayloadSchema,
  type FlightTrackInput,
} from '$lib/track/schema';
import {
  canAccessFlight,
  isFlightParticipant,
} from '$lib/server/authorization/flight';
import type { ApiPrincipal } from './principal';
import { ApiOperationError } from './errors';
import { requireApiScope } from './access';

const authorize = async (
  principal: ApiPrincipal,
  flightId: number,
  write: boolean,
) => {
  if (
    !(await canAccessFlight(
      principal.authorization,
      write ? 'update' : 'read',
      flightId,
    ))
  )
    throw new ApiOperationError('not_found', 'Flight not found', 404);
  const participant = await isFlightParticipant(principal.user.id, flightId);
  requireApiScope(principal, write ? 'tracks.write' : 'tracks.read');
  requireApiScope(
    principal,
    participant
      ? write
        ? 'flight.update.own'
        : 'flight.read.own'
      : write
        ? 'flight.update.any'
        : 'flight.read.any',
  );
};

export const getApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await authorize(principal, flightId, false);
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

export const setApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
  track: FlightTrackInput,
) => {
  await authorize(principal, flightId, true);
  await upsertFlightTrackPrimitiveWithConnection(db, flightId, track);
  return getApiFlightTrack(principal, flightId);
};

export const deleteApiFlightTrack = async (
  principal: ApiPrincipal,
  flightId: number,
) => {
  await authorize(principal, flightId, true);
  await deleteFlightTrackPrimitiveWithConnection(db, flightId);
};
