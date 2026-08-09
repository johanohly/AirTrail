import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';
import { db } from '$lib/db';
import type { Permission } from '$lib/authorization/permissions';
import { hasPermission } from './authorize';
import type { AuthorizationContext } from './context';

type FlightAction = 'read' | 'update' | 'delete' | 'passengers.manage';

export const isFlightParticipant = async (
  userId: string,
  flightId: number,
  connection: Kysely<DB> = db,
) =>
  Boolean(
    await connection
      .selectFrom('flightPassenger')
      .select('id')
      .where('flightId', '=', flightId)
      .where('userId', '=', userId)
      .executeTakeFirst(),
  );

export const canAccessFlight = async (
  authorization: AuthorizationContext,
  action: FlightAction,
  flightId: number,
  connection: Kysely<DB> = db,
) => {
  const anyPermission = `flight.${action}.any` as Permission;
  if (hasPermission(authorization, anyPermission)) return true;

  const ownPermission = `flight.${action}.own` as Permission;
  return (
    hasPermission(authorization, ownPermission) &&
    (await isFlightParticipant(authorization.userId, flightId, connection))
  );
};
