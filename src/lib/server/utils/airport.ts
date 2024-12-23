import { db } from '$lib/db';
import { findAirportsPrimitive } from '$lib/db/queries';

export const findAirports = async (input: string) => {
  return await findAirportsPrimitive(db, input);
};
