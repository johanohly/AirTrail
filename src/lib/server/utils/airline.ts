import { z } from 'zod';

import { db } from '$lib/db';
import type { Airline } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { airlineSchema } from '$lib/zod/airline';

export const getAirline = async (id: number): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const getAirlineByIcao = async (
  input: string,
): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('icao', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getAirlineById = async (id: number): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const findAirline = async (input: string): Promise<Airline[] | null> => {
  return await db
    .selectFrom('airline')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('name', 'ilike', `%${input}%`),
        eb('icao', 'ilike', `%${input}%`),
        eb('iata', 'ilike', `%${input}%`),
      ]),
    )
    .orderBy('name')
    .limit(10)
    .execute();
};

export const createAirline = async (data: Airline) => {
  await db.insertInto('airline').values(data).execute();
};

export const updateAirline = async (data: Airline) => {
  await db.updateTable('airline').set(data).where('id', '=', data.id).execute();
};

export const validateAndSaveAirline = async (
  airline: z.infer<typeof airlineSchema>,
): Promise<ErrorActionResult> => {
  const existingAirline = await getAirline(airline.id);
  let updating = false;
  if (existingAirline) {
    updating = true;
  }

  if (updating) {
    try {
      await updateAirline(airline);
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update airline',
      };
    }

    return {
      success: true,
      message: 'Airline updated',
    };
  } else {
    try {
      await createAirline(airline);
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create airline',
      };
    }

    return {
      success: true,
      message: 'Airline created',
    };
  }
};
