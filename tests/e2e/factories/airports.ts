import { db } from '@test/db';
import type { Airport } from '$lib/db/types';

export interface AirportInput {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  continent: 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC' | 'AN';
  tz: string;
  type:
    | 'large_airport'
    | 'medium_airport'
    | 'small_airport'
    | 'heliport'
    | 'seaplane_base'
    | 'balloonport'
    | 'closed';
  iata?: string | null;
  custom?: boolean;
}

export const airportsFactory = {
  async getOrCreate(
    input: AirportInput,
  ): Promise<{ airport: Airport }> {
    // Check if airport already exists
    const existing = await db
      .selectFrom('airport')
      .selectAll()
      .where('icao', '=', input.icao)
      .executeTakeFirst();

    if (existing) {
      return { airport: existing };
    }

    // Create new airport
    const result = await db
      .insertInto('airport')
      .values({
        icao: input.icao,
        name: input.name,
        lat: input.lat,
        lon: input.lon,
        country: input.country,
        continent: input.continent,
        tz: input.tz,
        type: input.type,
        iata: input.iata ?? null,
        custom: input.custom ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { airport: result };
  },
};