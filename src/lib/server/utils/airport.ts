import { z } from 'zod';

import { db } from '$lib/db';
import { findAirportsPrimitive } from '$lib/db/queries';
import type { Airport } from '$lib/db/types';
import type { ErrorActionResult } from '$lib/utils/forms';
import type { airportSchema } from '$lib/zod/airport';

export const getAirport = async (input: number): Promise<Airport | null> => {
  return (
    (await db
      .selectFrom('airport')
      .selectAll()
      .where('id', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const getAirportByIcao = async (
  input: string,
): Promise<Airport | null> => {
  return (
    (await db
      .selectFrom('airport')
      .selectAll()
      .where('icao', 'ilike', input)
      .executeTakeFirst()) ?? null
  );
};

export const findAirports = async (input: string): Promise<Airport[]> => {
  return await findAirportsPrimitive(db, input);
};

export const createAirport = async (data: Airport) => {
  await db.insertInto('airport').values(data).execute();
};

export const updateAirport = async (data: Airport) => {
  await db.updateTable('airport').set(data).where('id', '=', data.id).execute();
};

export const validateAndSaveAirport = async (
  data: z.infer<typeof airportSchema>,
): Promise<ErrorActionResult> => {
  const pathError = (path: string, message: string) => {
    return { success: false, type: 'path', path, message } as const;
  };

  const airport = {
    ...data,
    iata: data.iata !== '' ? data.iata : null,
    custom: true,
  };

  const existingAirport = await getAirportByIcao(airport.icao);
  let updating = false;
  if (existingAirport && !existingAirport.custom) {
    return pathError('icao', 'Code already used');
  } else if (existingAirport) {
    updating = true;
  }

  if (updating) {
    try {
      await updateAirport(airport);
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to update airport',
      };
    }

    return {
      success: true,
      message: 'Airport updated',
    };
  } else {
    try {
      await createAirport(airport);
    } catch (_) {
      return {
        success: false,
        type: 'error',
        message: 'Failed to create airport',
      };
    }

    return {
      success: true,
      message: 'Airport created',
    };
  }
};
