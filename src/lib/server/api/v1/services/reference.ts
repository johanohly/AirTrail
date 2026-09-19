import { db } from '$lib/db';
import { toAircraftDto, toAirlineDto, toAirportDto } from '$lib/api/v1/dto';
import { findAircraft } from '$lib/server/utils/aircraft';
import { findAirline } from '$lib/server/utils/airline';
import { findAirports } from '$lib/server/utils/airport';
import { requireApiScope } from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

export const searchAirports = async (
  principal: ApiPrincipal,
  query: string,
) => {
  requireApiScope(principal, 'reference_data.read');
  return (await findAirports(query)).map(toAirportDto);
};

export const searchAirlines = async (
  principal: ApiPrincipal,
  query: string,
) => {
  requireApiScope(principal, 'reference_data.read');
  return ((await findAirline(query)) ?? []).map(toAirlineDto);
};

export const searchAircraft = async (
  principal: ApiPrincipal,
  query: string,
) => {
  requireApiScope(principal, 'reference_data.read');
  return ((await findAircraft(query)) ?? []).map(toAircraftDto);
};

/*
 * Each getter owns its table query so the row type and the DTO stay correlated
 * (`dto(row)`, not `dto(row as never)`); only the not-found handling is shared.
 */
const getReferenceRow = async <T>(
  principal: ApiPrincipal,
  load: () => Promise<T | null>,
  label: string,
): Promise<T> => {
  requireApiScope(principal, 'reference_data.read');
  const row = await load();
  if (!row) throw new ApiOperationError('not_found', `${label} not found`);
  return row;
};

export const getAirport = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(
    principal,
    async () => {
      const row = await db
        .selectFrom('airport')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toAirportDto(row) : null;
    },
    'Airport',
  );

export const getAirline = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(
    principal,
    async () => {
      const row = await db
        .selectFrom('airline')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toAirlineDto(row) : null;
    },
    'Airline',
  );

export const getAircraft = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(
    principal,
    async () => {
      const row = await db
        .selectFrom('aircraft')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toAircraftDto(row) : null;
    },
    'Aircraft',
  );
