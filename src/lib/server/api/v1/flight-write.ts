import { db } from '$lib/db';
import type { DatabaseConnection } from '$lib/db/types';
import { getFlightPrimitive } from '$lib/db/queries';
import type { CreateFlight } from '$lib/db/types';
import {
  flightScope,
  passengersManageScope,
  type FlightScopeOwnership,
} from '$lib/api/v1/scopes';
import type { z } from 'zod';
import type { flightInputSchema } from '$lib/api/v1/schemas';
import type { ApiPrincipal } from './principal';
import { ApiOperationError } from './errors';
import {
  canAccessFlight,
  canCreateFlight,
} from '$lib/server/authorization/flight';
import {
  persistFlightAggregate,
  planFlightAggregate,
} from '$lib/server/utils/flight';
import { requireApiScope, requireFlightScope } from './access';

type FlightInput = z.infer<typeof flightInputSchema>;

/*
 * `track` is part of the flight payload and flows through to the flight_track
 * table, where a null value deletes the existing track. Writing it through a
 * flight create/update must therefore cost the same scope as writing it through
 * /flights/{id}/track, or `tracks.write` would be trivially bypassable.
 */
const requireTrackScopeWhenWritten = (
  principal: ApiPrincipal,
  input: FlightInput,
) => {
  if ('track' in input) requireApiScope(principal, 'tracks.write');
};

/*
 * The passenger half of a flight update, keyed on the write plan's
 * `passengersChanged` so a custom-field-only edit is authorized like any other
 * passenger change. `ownership` is the caller's already-resolved scope.
 */
export const requirePassengerManageScope = async (
  principal: ApiPrincipal,
  trx: DatabaseConnection,
  flightId: number,
  {
    ownership,
    passengersChanged,
  }: { ownership: FlightScopeOwnership; passengersChanged: boolean },
) => {
  if (!passengersChanged) return;
  if (
    !(await canAccessFlight(
      principal.authorization,
      'passengers.manage',
      flightId,
      trx,
    ))
  )
    throw new ApiOperationError('not_found', 'Flight not found');
  requireApiScope(principal, passengersManageScope(ownership));
};

const resolveReferences = async (
  connection: DatabaseConnection,
  input: FlightInput,
): Promise<CreateFlight> => {
  /*
   * Sequential on purpose: these run inside the caller's Kysely transaction,
   * and concurrent queries on one transaction connection are not a supported
   * guarantee even though node-postgres currently queues them.
   */
  const from = await connection
    .selectFrom('airport')
    .selectAll()
    .where('id', '=', input.fromId)
    .executeTakeFirst();
  const to = await connection
    .selectFrom('airport')
    .selectAll()
    .where('id', '=', input.toId)
    .executeTakeFirst();
  const aircraft = input.aircraftId
    ? await connection
        .selectFrom('aircraft')
        .selectAll()
        .where('id', '=', input.aircraftId)
        .executeTakeFirst()
    : null;
  const airline = input.airlineId
    ? await connection
        .selectFrom('airline')
        .selectAll()
        .where('id', '=', input.airlineId)
        .executeTakeFirst()
    : null;
  if (!from || !to)
    throw new ApiOperationError(
      'validation_failed',
      'Departure and arrival airports must exist',
    );
  if (input.aircraftId && !aircraft)
    throw new ApiOperationError('validation_failed', 'Aircraft does not exist');
  if (input.airlineId && !airline)
    throw new ApiOperationError('validation_failed', 'Airline does not exist');
  const {
    fromId: _fromId,
    toId: _toId,
    aircraftId: _aircraftId,
    airlineId: _airlineId,
    customFields: _customFields,
    ...rest
  } = input;
  return {
    ...rest,
    from,
    to,
    aircraft: aircraft ?? null,
    airline: airline ?? null,
  };
};

export const createApiFlight = async (
  principal: ApiPrincipal,
  input: FlightInput,
) => {
  const includesActor = input.passengers.some(
    ({ userId }) => userId === principal.user.id,
  );
  requireApiScope(
    principal,
    flightScope('create', includesActor ? 'own' : 'any'),
  );
  requireTrackScopeWhenWritten(principal, input);
  if (!canCreateFlight(principal.authorization, input.passengers))
    throw new ApiOperationError(
      'forbidden',
      'The current role cannot create this flight',
    );
  return db.transaction().execute(async (trx) => {
    const values = await resolveReferences(trx, input);
    const plan = await planFlightAggregate(trx, {
      existing: null,
      values,
      customFields: input.customFields,
    });
    return persistFlightAggregate(trx, { existing: null, values, plan });
  });
};

export const updateApiFlight = async (
  principal: ApiPrincipal,
  id: number,
  input: FlightInput,
) => {
  return db.transaction().execute(async (trx) => {
    const existing = await getFlightPrimitive(trx, id);
    if (!existing) throw new ApiOperationError('not_found', 'Flight not found');
    const ownership = await requireFlightScope(principal, 'update', id, trx);
    requireTrackScopeWhenWritten(principal, input);
    const values = await resolveReferences(trx, input);
    const plan = await planFlightAggregate(trx, {
      existing,
      values,
      customFields: input.customFields,
    });
    await requirePassengerManageScope(principal, trx, id, {
      ownership,
      passengersChanged: plan.passengersChanged,
    });
    await persistFlightAggregate(trx, { existing, values, plan });
    return id;
  });
};

export const deleteApiFlight = async (principal: ApiPrincipal, id: number) => {
  await requireFlightScope(principal, 'delete', id);
  const deleted = await db
    .deleteFrom('flight')
    .where('id', '=', id)
    .executeTakeFirst();
  if (deleted.numDeletedRows !== 1n)
    throw new ApiOperationError('not_found', 'Flight not found');
};
