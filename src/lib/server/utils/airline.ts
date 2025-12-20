import { z } from 'zod';

import { db } from '$lib/db';
import type { Airline } from '$lib/db/types';
import { uploadManager } from '$lib/server/utils/uploads';
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

export const getAirlineByName = async (
  input: string,
): Promise<Airline | null> => {
  return (
    (await db
      .selectFrom('airline')
      .selectAll()
      .where('name', 'ilike', input)
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

export const createAirline = async (data: Omit<Airline, 'id'>) => {
  await db.insertInto('airline').values(data).execute();
};

export const updateAirline = async (data: Airline) => {
  await db.updateTable('airline').set(data).where('id', '=', data.id).execute();
};

export const validateAndSaveAirline = async (
  airline: z.infer<typeof airlineSchema>,
): Promise<ErrorActionResult> => {
  const existingAirline = airline.id ? await getAirline(airline.id) : null;

  if (existingAirline) {
    try {
      // Don't update iconPath - it's managed separately via the icon upload API
      await db
        .updateTable('airline')
        .set({
          name: airline.name,
          icao: airline.icao,
          iata: airline.iata,
        })
        .where('id', '=', existingAirline.id)
        .execute();
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
      await createAirline({
        name: airline.name,
        icao: airline.icao,
        iata: airline.iata,
        iconPath: airline.iconPath ?? null,
      });
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

export const validateAirlineIcons = async (): Promise<void> => {
  if (!uploadManager.isConfigured) {
    return;
  }

  const airlines = await db
    .selectFrom('airline')
    .select(['id', 'iconPath'])
    .where('iconPath', 'is not', null)
    .execute();

  for (const airline of airlines) {
    if (airline.iconPath && !uploadManager.fileExists(airline.iconPath)) {
      console.warn(
        `Airline ${airline.id} has missing icon file: ${airline.iconPath}. Setting to null.`,
      );
      await db
        .updateTable('airline')
        .set({ iconPath: null })
        .where('id', '=', airline.id)
        .execute();
    }
  }
};
