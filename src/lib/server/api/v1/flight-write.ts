import { db } from '$lib/db';
import type { DatabaseConnection } from '$lib/db/types';
import { getFlightPrimitive } from '$lib/db/queries';
import type { CreateFlight } from '$lib/db/types';
import { flightScope } from '$lib/api/v1/scopes';
import type { z } from 'zod';
import type { flightInputSchema } from '$lib/api/v1/schemas';
import type { ApiPrincipal } from './principal';
import { ApiOperationError } from './errors';
import {
  canAccessFlight,
  canCreateFlight,
  flightOwnership,
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

const resolveReferences = async (
  connection: DatabaseConnection,
  input: FlightInput,
): Promise<CreateFlight> => {
  const [from, to, aircraft, airline] = await Promise.all([
    connection
      .selectFrom('airport')
      .selectAll()
      .where('id', '=', input.fromId)
      .executeTakeFirst(),
    connection
      .selectFrom('airport')
      .selectAll()
      .where('id', '=', input.toId)
      .executeTakeFirst(),
    input.aircraftId
      ? connection
          .selectFrom('aircraft')
          .selectAll()
          .where('id', '=', input.aircraftId)
          .executeTakeFirst()
      : null,
    input.airlineId
      ? connection
          .selectFrom('airline')
          .selectAll()
          .where('id', '=', input.airlineId)
          .executeTakeFirst()
      : null,
  ]);
  if (!from || !to)
    throw new ApiOperationError(
      'validation_failed',
      'Departure and arrival airports must exist',
      422,
    );
  if (input.aircraftId && !aircraft)
    throw new ApiOperationError(
      'validation_failed',
      'Aircraft does not exist',
      422,
    );
  if (input.airlineId && !airline)
    throw new ApiOperationError(
      'validation_failed',
      'Airline does not exist',
      422,
    );
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
      403,
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
    if (
      !existing ||
      !(await canAccessFlight(principal.authorization, 'update', id, trx))
    )
      throw new ApiOperationError('not_found', 'Flight not found', 404);
    const ownership = await flightOwnership(principal.user.id, id, trx);
    requireApiScope(principal, flightScope('update', ownership));
    requireTrackScopeWhenWritten(principal, input);
    const values = await resolveReferences(trx, input);
    const plan = await planFlightAggregate(trx, {
      existing,
      values,
      customFields: input.customFields,
    });
    if (
      plan.passengersChanged &&
      !(await canAccessFlight(
        principal.authorization,
        'passengers.manage',
        id,
        trx,
      ))
    )
      throw new ApiOperationError('not_found', 'Flight not found', 404);
    if (plan.passengersChanged)
      requireApiScope(
        principal,
        ownership === 'own'
          ? 'flight.passengers.manage.own'
          : 'flight.passengers.manage.any',
      );
    await persistFlightAggregate(trx, { existing, values, plan });
    return id;
  });
};

export const deleteApiFlight = async (principal: ApiPrincipal, id: number) => {
  if (!(await canAccessFlight(principal.authorization, 'delete', id)))
    throw new ApiOperationError('not_found', 'Flight not found', 404);
  await requireFlightScope(principal, 'delete', id);
  const deleted = await db
    .deleteFrom('flight')
    .where('id', '=', id)
    .executeTakeFirst();
  if (deleted.numDeletedRows !== 1n)
    throw new ApiOperationError('not_found', 'Flight not found', 404);
};
