import { db } from '@test/db';
import type { Insertable } from 'kysely';

import type { DB } from '$lib/db/schema';

export interface FlightInput {
  date: string;
  fromId: number;
  toId: number;
  departure?: string | null;
  arrival?: string | null;
  duration?: number | null;
  flightNumber?: string | null;
  aircraftReg?: string | null;
  note?: string | null;
  aircraftId?: number | null;
  airlineId?: number | null;
}

type PassengerInput = Pick<
  Insertable<DB['flightPassenger']>,
  'seat' | 'seatNumber' | 'seatClass' | 'flightReason'
>;

export interface FlightWithPassenger extends FlightInput {
  userId: string;
  passenger?: PassengerInput;
}

export const flightsFactory = {
  async create(
    input: FlightWithPassenger,
  ): Promise<{ flight: { id: number } }> {
    // Insert flight
    const flightResult = await db
      .insertInto('flight')
      .values({
        date: input.date,
        fromId: input.fromId,
        toId: input.toId,
        departure: input.departure ?? null,
        arrival: input.arrival ?? null,
        duration: input.duration ?? null,
        flightNumber: input.flightNumber ?? null,
        aircraftReg: input.aircraftReg ?? null,
        note: input.note ?? null,
        aircraftId: input.aircraftId ?? null,
        airlineId: input.airlineId ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Insert the user's passenger record for the flight
    await db
      .insertInto('flightPassenger')
      .values({
        flightId: flightResult.id,
        userId: input.userId,
        seat: input.passenger?.seat ?? null,
        seatNumber: input.passenger?.seatNumber ?? null,
        seatClass: input.passenger?.seatClass ?? null,
        flightReason: input.passenger?.flightReason ?? null,
        guestName: null,
      })
      .execute();

    return { flight: { id: flightResult.id } };
  },
};
