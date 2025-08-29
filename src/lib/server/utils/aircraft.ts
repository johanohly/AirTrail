import { z } from 'zod';

import { db } from '$lib/db';
import type { Aircraft } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { aircraftSchema } from '$lib/zod/aircraft';

export const getAircraft = async (id: number): Promise<Aircraft | null> => {
  return (
    (await db
      .selectFrom('aircraft')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()) ?? null
  );
};

export const getAircraftByIcao = async (
  input: string,
): Promise<Aircraft | null> => {
  return (
    (await db
      .selectFrom('aircraft')
      .selectAll()
      .where('icao', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findAircraft = async (
  input: string,
): Promise<Aircraft[] | null> => {
  return await db
    .selectFrom('aircraft')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('name', 'ilike', `%${input}%`),
        eb('icao', 'ilike', `%${input}%`),
      ]),
    )
    .orderBy('name')
    .limit(10)
    .execute();
};

export const createAircraft = async (data: Omit<Aircraft, 'id'>) => {
  await db.insertInto('aircraft').values(data).execute();
};

export const updateAircraft = async (data: Aircraft) => {
  await db
    .updateTable('aircraft')
    .set(data)
    .where('id', '=', data.id)
    .execute();
};

export const validateAndSaveAircraft = async (
  aircraft: z.infer<typeof aircraftSchema>,
): Promise<ErrorActionResult> => {
  const existingAircraft = aircraft.id ? await getAircraft(aircraft.id) : null;

  if (existingAircraft) {
    try {
      await updateAircraft(aircraft);
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update aircraft',
      };
    }

    return {
      success: true,
      message: 'Aircraft updated',
    };
  } else {
    try {
      await createAircraft({
        name: aircraft.name,
        icao: aircraft.icao,
      });
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create aircraft',
      };
    }

    return {
      success: true,
      message: 'Aircraft created',
    };
  }
};
