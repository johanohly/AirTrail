import { db } from '$lib/db';
import {
  createFlightPrimitiveWithConnection,
  getFlightPrimitive,
  resolveFlightPassengerChanges,
  updateFlightPrimitiveWithConnection,
} from '$lib/db/queries';
import type { CreateFlight } from '$lib/db/types';
import type { z } from 'zod';
import type { flightInputSchema } from '$lib/api/v1/schemas';
import type { ApiPrincipal } from './principal';
import { ApiOperationError } from './errors';
import {
  canAccessFlight,
  canCreateFlight,
} from '$lib/server/authorization/flight';
import { isFlightParticipant } from '$lib/server/authorization/flight';
import { passengerRecordsChanged } from '$lib/server/utils/flight';
import {
  prepareEntityCustomFieldPlan,
  persistEntityCustomFieldPlan,
  validateEntityCustomFieldPlan,
} from '$lib/server/utils/custom-fields';
import { requireApiScope } from './access';

type FlightInput = z.infer<typeof flightInputSchema>;

const resolveReferences = async (
  connection: typeof db,
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
    includesActor ? 'flight.create.own' : 'flight.create.any',
  );
  if (!canCreateFlight(principal.authorization, input.passengers))
    throw new ApiOperationError(
      'forbidden',
      'The current role cannot create this flight',
      403,
    );
  return db.transaction().execute(async (trx) => {
    const values = await resolveReferences(trx as typeof db, input);
    const flightPlan = await prepareEntityCustomFieldPlan(trx, {
      entityType: 'flight',
      entities: [{ entityId: null, values: input.customFields }],
    });
    const passengerPlan = await prepareEntityCustomFieldPlan(trx, {
      entityType: 'flight_passenger',
      entities: input.passengers.map((passenger) => ({
        entityId: null,
        values: passenger.customFields,
      })),
    });
    validateEntityCustomFieldPlan(flightPlan);
    validateEntityCustomFieldPlan(passengerPlan);
    const created = await createFlightPrimitiveWithConnection(trx, values);
    await persistEntityCustomFieldPlan(trx, flightPlan, [
      String(created.flightId),
    ]);
    await persistEntityCustomFieldPlan(
      trx,
      passengerPlan,
      created.passengers.map(({ id }) => String(id)),
    );
    return created.flightId;
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
    const participant = await isFlightParticipant(principal.user.id, id, trx);
    requireApiScope(
      principal,
      participant ? 'flight.update.own' : 'flight.update.any',
    );
    const values = await resolveReferences(trx as typeof db, input);
    const changes = resolveFlightPassengerChanges(
      existing.passengers,
      values.passengers,
    );
    const passengersChanged = passengerRecordsChanged(
      existing.passengers,
      values.passengers,
    );
    if (
      passengersChanged &&
      !(await canAccessFlight(
        principal.authorization,
        'passengers.manage',
        id,
        trx,
      ))
    )
      throw new ApiOperationError('not_found', 'Flight not found', 404);
    if (passengersChanged)
      requireApiScope(
        principal,
        participant
          ? 'flight.passengers.manage.own'
          : 'flight.passengers.manage.any',
      );
    const flightPlan = await prepareEntityCustomFieldPlan(trx, {
      entityType: 'flight',
      entities: [{ entityId: String(id), values: input.customFields }],
    });
    const passengerPlan = await prepareEntityCustomFieldPlan(trx, {
      entityType: 'flight_passenger',
      entities: changes.resolved.map(({ passenger, existing }) => ({
        entityId: existing ? String(existing.id) : null,
        values: passenger.customFields,
      })),
    });
    validateEntityCustomFieldPlan(flightPlan);
    if (passengersChanged) validateEntityCustomFieldPlan(passengerPlan);
    const persisted = await updateFlightPrimitiveWithConnection(
      trx,
      id,
      values,
    );
    await persistEntityCustomFieldPlan(trx, flightPlan, [String(id)]);
    if (passengersChanged)
      await persistEntityCustomFieldPlan(
        trx,
        passengerPlan,
        persisted.map(({ id }) => String(id)),
      );
    return id;
  });
};

export const deleteApiFlight = async (principal: ApiPrincipal, id: number) => {
  if (!(await canAccessFlight(principal.authorization, 'delete', id)))
    throw new ApiOperationError('not_found', 'Flight not found', 404);
  const participant = await isFlightParticipant(principal.user.id, id);
  requireApiScope(
    principal,
    participant ? 'flight.delete.own' : 'flight.delete.any',
  );
  const deleted = await db
    .deleteFrom('flight')
    .where('id', '=', id)
    .executeTakeFirst();
  if (deleted.numDeletedRows !== 1n)
    throw new ApiOperationError('not_found', 'Flight not found', 404);
};
