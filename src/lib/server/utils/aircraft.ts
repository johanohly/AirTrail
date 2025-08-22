import { z } from 'zod';

import { db } from '$lib/db';
import type { Aircraft, CreateAircraft } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { aircraftSchema } from '$lib/zod/aircraft';

export const getAircraft = async (input: string): Promise<Aircraft | null> => {
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

export const createAircraft = async (data: Aircraft) => {
  await db.insertInto('aircraft').values(data).execute();
};

export const updateAircraft = async (data: CreateAircraft) => {
  await db
    .updateTable('aircraft')
    .set(data)
    .where('icao', '=', data.icao)
    .execute();
};

export const validateAndSaveAircraft = async (
  data: z.infer<typeof aircraftSchema>,
): Promise<ErrorActionResult> => {
  const pathError = (path: string, message: string) => {
    return { success: false, type: 'path', path, message } as const;
  };

  const aircraft = {
    ...data,
    icao: data.icao.toUpperCase(),
  };

  const icao = aircraft.icao;
  const existingAircraft = await getAircraft(icao);
  let updating = false;
  if (existingAircraft) {
    updating = true;
  }

  if (updating) {
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
      await createAircraft(aircraft);
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
