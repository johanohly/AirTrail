import { db } from '$lib/db';
import { toAircraftDto, toAirlineDto, toAirportDto } from '$lib/api/v1/dto';
import { findAircraft } from '$lib/server/utils/aircraft';
import { findAirline } from '$lib/server/utils/airline';
import { findAirports } from '$lib/server/utils/airport';
import { ApiOperationError } from '../errors';

export const searchAirports = async (query: string) =>
  (await findAirports(query)).map(toAirportDto);

export const searchAirlines = async (query: string) =>
  ((await findAirline(query)) ?? []).map(toAirlineDto);

export const searchAircraft = async (query: string) =>
  ((await findAircraft(query)) ?? []).map(toAircraftDto);

const getReferenceRow = async <T>(
  load: () => Promise<T | null>,
  label: string,
): Promise<T> => {
  const row = await load();
  if (!row) throw new ApiOperationError('not_found', `${label} not found`);
  return row;
};

export const getAirport = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('airport')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toAirportDto(row) : null;
  }, 'Airport');

export const getAirline = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('airline')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toAirlineDto(row) : null;
  }, 'Airline');

export const getAircraft = (id: number) =>
  getReferenceRow(async () => {
    const row = await db
      .selectFrom('aircraft')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toAircraftDto(row) : null;
  }, 'Aircraft');
