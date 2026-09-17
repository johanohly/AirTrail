import { db } from '$lib/db';
import { toAircraftDto, toAirlineDto, toAirportDto } from '$lib/api/v1/dto';
import { findAircraft } from '$lib/server/utils/aircraft';
import { findAirline } from '$lib/server/utils/airline';
import { findAirports } from '$lib/server/utils/airport';
import { requireApiScope } from '../access';
import { ApiOperationError } from '../errors';
import type { ApiPrincipal } from '../principal';

const REFERENCE_TABLES = {
  airport: { table: 'airport', label: 'Airport', dto: toAirportDto },
  airline: { table: 'airline', label: 'Airline', dto: toAirlineDto },
  aircraft: { table: 'aircraft', label: 'Aircraft', dto: toAircraftDto },
} as const;

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

const getReferenceRow = async (
  principal: ApiPrincipal,
  kind: keyof typeof REFERENCE_TABLES,
  id: number,
) => {
  requireApiScope(principal, 'reference_data.read');
  const { table, label, dto } = REFERENCE_TABLES[kind];
  const row = await db
    .selectFrom(table)
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) throw new ApiOperationError('not_found', `${label} not found`, 404);
  return dto(row as never);
};

export const getAirport = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(principal, 'airport', id);
export const getAirline = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(principal, 'airline', id);
export const getAircraft = (principal: ApiPrincipal, id: number) =>
  getReferenceRow(principal, 'aircraft', id);
