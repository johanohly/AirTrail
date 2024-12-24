import { db } from '$lib/db';
import { findAirportsPrimitive } from '$lib/db/queries';

export const getAirport = async (input: string) => {
  return (
    (await db
      .selectFrom('airport')
      .selectAll()
      .where('code', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findAirports = async (input: string) => {
  return await findAirportsPrimitive(db, input);
};
