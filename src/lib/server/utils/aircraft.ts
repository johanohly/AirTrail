import { z } from 'zod';
import { sql } from 'kysely';

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
      .where('specific', '=', false)
      .executeTakeFirst()) ?? null
  );
};

export const getAircraftByName = async (
  input: string,
): Promise<Aircraft | null> => {
  return (
    (await db
      .selectFrom('aircraft')
      .selectAll()
      .where('name', 'ilike', input)
      .where('specific', '=', false)
      .executeTakeFirst()) ?? null
  );
};

export const findAircraft = async (
  input: string,
  options?: { specific?: boolean },
): Promise<Aircraft[] | null> => {
  const pattern = `%${input}%`;

  let query = db
    .selectFrom('aircraft')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('name', 'ilike', pattern),
        eb('icao', 'ilike', input),
        eb('serialNumber', 'ilike', input),
      ]),
    );
  if (options?.specific !== undefined) {
    query = query.where('specific', '=', options.specific);
  }

  return await query
    .select(
      sql`CASE
            WHEN "icao" ILIKE ${input} THEN 1
            WHEN "serial_number" ILIKE ${input} THEN 1
            WHEN "name" ILIKE ${pattern} THEN 2
            ELSE 3
          END`.as('match_rank'),
    )
    .orderBy('match_rank', 'asc')
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

const validateAircraftType = async (
  aircraft: z.infer<typeof aircraftSchema>,
): Promise<string | null> => {
  if (!aircraft.specific) return null;

  if (aircraft.id !== null) {
    const airframe = await db
      .selectFrom('aircraft')
      .select('id')
      .where('typeId', '=', aircraft.id)
      .executeTakeFirst();
    if (airframe) {
      return 'This aircraft is the type of specific aircraft and must stay generic';
    }
  }

  if (aircraft.typeId === null) return null;
  if (aircraft.typeId === aircraft.id) {
    return 'An aircraft cannot be its own type';
  }
  const type = await getAircraft(aircraft.typeId);
  if (!type) return 'Aircraft type not found';
  if (type.specific) return 'Aircraft type must be a generic aircraft';
  return null;
};

const specificFields = (aircraft: z.infer<typeof aircraftSchema>) =>
  aircraft.specific
    ? {
        specific: true,
        typeId: aircraft.typeId,
        serialNumber: aircraft.serialNumber?.trim() || null,
        firstFlight: aircraft.firstFlight || null,
      }
    : {
        specific: false,
        typeId: null,
        serialNumber: null,
        firstFlight: null,
      };

export const validateAndSaveAircraft = async (
  aircraft: z.infer<typeof aircraftSchema>,
): Promise<ErrorActionResult> => {
  const existingAircraft = aircraft.id ? await getAircraft(aircraft.id) : null;

  const typeError = await validateAircraftType(aircraft);
  if (typeError) {
    return { success: false, type: 'error', message: typeError };
  }

  if (existingAircraft) {
    try {
      await updateAircraft({
        ...existingAircraft,
        name: aircraft.name,
        icao: aircraft.icao,
        ...specificFields(aircraft),
      });
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
        sourceId: null,
        ...specificFields(aircraft),
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
