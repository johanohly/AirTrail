import type { Kysely } from 'kysely';

import type { DB } from '$lib/db/schema';
import { db } from '$lib/db';
import type { FlightScope } from '$lib/flight-scope';
import { hasPermission } from './authorize';
import type { AuthorizationContext } from './context';

type FlightOwnershipScope = 'own' | 'any';
type FlightAccessAction = 'read' | 'update' | 'delete' | 'passengers.manage';

const FLIGHT_ACCESS_PERMISSIONS = {
  read: { own: 'flight.read.own', any: 'flight.read.any' },
  update: { own: 'flight.update.own', any: 'flight.update.any' },
  delete: { own: 'flight.delete.own', any: 'flight.delete.any' },
  'passengers.manage': {
    own: 'flight.passengers.manage.own',
    any: 'flight.passengers.manage.any',
  },
} as const;

const FLIGHT_CREATE_PERMISSIONS = {
  own: 'flight.create.own',
  any: 'flight.create.any',
} as const;

const FLIGHT_EXPORT_PERMISSIONS = {
  own: 'flight.export.own',
  any: 'flight.export.any',
} as const;

const ownershipScopeForList = (scope: FlightScope): FlightOwnershipScope =>
  scope.scope === 'mine' ? 'own' : 'any';

export const canListFlights = (
  authorization: AuthorizationContext,
  scope: FlightScope,
) =>
  hasPermission(
    authorization,
    FLIGHT_ACCESS_PERMISSIONS.read[ownershipScopeForList(scope)],
  );

export const canExportFlights = (
  authorization: AuthorizationContext,
  scope: FlightScope,
) =>
  hasPermission(
    authorization,
    FLIGHT_EXPORT_PERMISSIONS[ownershipScopeForList(scope)],
  );

export const canShareOwnFlights = (authorization: AuthorizationContext) =>
  hasPermission(authorization, 'flight.read.own') &&
  hasPermission(authorization, 'flight.share.own');

export const canCreateFlight = (
  authorization: AuthorizationContext,
  passengers: readonly { userId: string | null }[],
) => {
  const includesActor = passengers.some(
    (passenger) => passenger.userId === authorization.userId,
  );
  const scope: FlightOwnershipScope = includesActor ? 'own' : 'any';

  if (!hasPermission(authorization, FLIGHT_CREATE_PERMISSIONS[scope])) {
    return false;
  }

  return (
    passengers.length <= 1 ||
    hasPermission(
      authorization,
      FLIGHT_ACCESS_PERMISSIONS['passengers.manage'][scope],
    )
  );
};

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
  action: FlightAccessAction,
  flightId: number,
  connection: Kysely<DB> = db,
) => {
  const permissions = FLIGHT_ACCESS_PERMISSIONS[action];
  if (hasPermission(authorization, permissions.any)) return true;

  return (
    hasPermission(authorization, permissions.own) &&
    (await isFlightParticipant(authorization.userId, flightId, connection))
  );
};

export const canAccessFlights = async (
  authorization: AuthorizationContext,
  action: FlightAccessAction,
  flightIds: readonly number[],
  connection: Kysely<DB> = db,
) => {
  const ids = [...new Set(flightIds)];
  if (ids.length === 0) return true;

  const permissions = FLIGHT_ACCESS_PERMISSIONS[action];
  if (hasPermission(authorization, permissions.any)) return true;
  if (!hasPermission(authorization, permissions.own)) return false;

  const participatingFlights = await connection
    .selectFrom('flightPassenger')
    .select('flightId')
    .distinct()
    .where('userId', '=', authorization.userId)
    .where('flightId', 'in', ids)
    .execute();
  return participatingFlights.length === ids.length;
};
