import { db } from '@test/db';
import type { Flight } from '$lib/db/types';

export interface FlightInput {
  date: string;
  fromId: number;
  toId: number;
  departure?: string | null;
  arrival?: string | null;
  duration?: number | null;
  flightNumber?: string | null;
  flightReason?: 'leisure' | 'business' | 'crew' | 'other' | null;
  aircraftReg?: string | null;
  note?: string | null;
  aircraftId?: number | null;
  airlineId?: number | null;
}

export interface FlightWithSeats extends FlightInput {
  userId: string;
  seat?: {
    seat?:
      | 'window'
      | 'aisle'
      | 'middle'
      | 'pilot'
      | 'copilot'
      | 'jumpseat'
      | 'other'
      | null;
    seatNumber?: string | null;
    seatClass?:
      | 'economy'
      | 'economy+'
      | 'business'
      | 'first'
      | 'private'
      | null;
    guestName?: string | null;
  };
}

export const flightsFactory = {
  async create(input: FlightWithSeats): Promise<{ flight: { id: number } }> {
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
        flightReason: input.flightReason ?? null,
        aircraftReg: input.aircraftReg ?? null,
        note: input.note ?? null,
        aircraftId: input.aircraftId ?? null,
        airlineId: input.airlineId ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Insert seat for the flight
    await db
      .insertInto('seat')
      .values({
        flightId: flightResult.id,
        userId: input.userId,
        seat: input.seat?.seat ?? null,
        seatNumber: input.seat?.seatNumber ?? null,
        seatClass: input.seat?.seatClass ?? null,
        guestName: input.seat?.guestName ?? null,
      })
      .execute();

    return { flight: { id: flightResult.id } };
  },
};
