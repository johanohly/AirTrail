import { db } from '$lib/db';
import { findAirportsPrimitive } from '$lib/db/queries';
import type { Airport } from '$lib/db/types';

export const getAirport = async (input: string): Promise<Airport | null> => {
  return (
    (await db
      .selectFrom('airport')
      .selectAll()
      .where('code', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findAirports = async (
  input: string,
): Promise<Airport[] | null> => {
  return await findAirportsPrimitive(db, input);
};
