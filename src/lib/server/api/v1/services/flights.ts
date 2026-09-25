import type { z } from 'zod';

import { toFlightDto } from '$lib/api/v1/dto';
import type { flightInputSchema } from '$lib/api/v1/schemas';
import { flightScope, flightScopeOwnership } from '$lib/api/v1/scopes';
import { db } from '$lib/db';
import type { CreateFlight, DatabaseConnection } from '$lib/db/types';
import { resolveFlightScope, type FlightScope } from '$lib/flight-scope';
import { generateBackup } from '$lib/server/utils/backup';
import {
  getFlight as loadFlight,
  listFlightsInScope,
  saveFlightAggregate,
} from '$lib/server/utils/flight';
import { computeCompletedFlightStatsSummary } from '$lib/stats/summary';
import {
  apiFlightWriter,
  requireApiScope,
  requireFlightScope,
} from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';
import {
  getFlightTrackSummary,
  listFlightsPage,
  type FlightPage,
} from './flight-page';

type FlightInput = z.infer<typeof flightInputSchema>;

/*
 * Which flights a list, export or stats call may see: the credential needs
 * `flight.<action>.<own|any>` for the resolved ownership, which the role must
 * also permit.
 */
export const visibleFlightScope = (
  principal: ApiPrincipal,
  scope: FlightScope,
  action: 'read' | 'export',
) => {
  requireApiScope(
    principal,
    flightScope(action, flightScopeOwnership(scope, principal.user.id)),
  );
  return resolveFlightScope(scope, principal.user.id);
};

export const getFlightStats = async (
  principal: ApiPrincipal,
  scope: FlightScope,
) =>
  computeCompletedFlightStatsSummary(
    await listFlightsInScope(visibleFlightScope(principal, scope, 'read')),
  );

export const listFlights = async (
  principal: ApiPrincipal,
  scope: FlightScope,
  page: FlightPage,
) => {
  const result = await listFlightsPage(
    visibleFlightScope(principal, scope, 'read'),
    page,
  );
  return {
    data: result.flights.map((flight) =>
      toFlightDto(flight, result.tracks.get(flight.id) ?? null),
    ),
    page: { nextCursor: result.nextCursor },
  };
};

export const exportFlights = async (
  principal: ApiPrincipal,
  scope: FlightScope,
) => generateBackup(visibleFlightScope(principal, scope, 'export'));

const flightDto = async (id: number) => {
  const flight = await loadFlight(id);
  if (!flight) throw new ApiOperationError('not_found', 'Flight not found');
  return toFlightDto(flight, await getFlightTrackSummary(id));
};

export const getFlight = async (principal: ApiPrincipal, id: number) => {
  await requireFlightScope(principal, 'read', id);
  return flightDto(id);
};

const resolveReferences = async (
  connection: DatabaseConnection,
  input: FlightInput,
): Promise<CreateFlight> => {
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

const saveFlight = async (
  principal: ApiPrincipal,
  id: number | null,
  input: FlightInput,
) =>
  saveFlightAggregate(apiFlightWriter(principal), {
    id,
    values: await resolveReferences(db, input),
    customFields: input.customFields,
  });

export const createFlight = (principal: ApiPrincipal, input: FlightInput) =>
  saveFlight(principal, null, input);

/** Returns the updated flight. */
export const updateFlight = async (
  principal: ApiPrincipal,
  id: number,
  input: FlightInput,
) => flightDto(await saveFlight(principal, id, input));

export const deleteFlight = async (principal: ApiPrincipal, id: number) => {
  await requireFlightScope(principal, 'delete', id);
  const deleted = await db
    .deleteFrom('flight')
    .where('id', '=', id)
    .executeTakeFirst();
  if (deleted.numDeletedRows !== 1n)
    throw new ApiOperationError('not_found', 'Flight not found');
};
