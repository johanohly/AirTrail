import { db } from '$lib/db';
import {
  createFlightPrimitive,
  getFlightPrimitive,
  listFlightPrimitive,
  updateFlightPrimitive,
} from '$lib/db/queries';
import type { CreateFlight } from '$lib/db/types';

export const listFlights = async (userId: string) => {
  return await listFlightPrimitive(db, userId);
};

export const getFlight = async (id: number) => {
  return await getFlightPrimitive(db, id);
};

export const createFlight = async (data: CreateFlight) => {
  await createFlightPrimitive(db, data);
};

export const deleteFlight = async (id: number) => {
  return await db.deleteFrom('flight').where('id', '=', id).executeTakeFirst();
};

export const updateFlight = async (id: number, data: CreateFlight) => {
  return await updateFlightPrimitive(db, id, data);
};
