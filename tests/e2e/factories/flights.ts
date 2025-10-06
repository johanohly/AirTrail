import { db } from '@test/db';
import { generateId } from 'lucia';

export interface Flight {
  id: string;
  date: string;
  fromId: string;
  toId: string;
  departure: string | null;
  arrival: string | null;
  duration: number | null;
  userId: string;
  flightNumber: string | null;
}

export const flightsFactory = {
  async create(
    userId: string,
    fromAirportId: string,
    toAirportId: string,
    overrides: Partial<Flight> = {},
  ): Promise<{ flight: Flight }> {
    const flight: Flight = {
      id: generateId(15),
      date: '2024-01-15',
      fromId: fromAirportId,
      toId: toAirportId,
      departure: null,
      arrival: null,
      duration: null,
      userId,
      flightNumber: null,
      ...overrides,
    };

    await db
      .insertInto('flight')
      .values({
        id: flight.id,
        date: flight.date,
        fromId: flight.fromId,
        toId: flight.toId,
        departure: flight.departure,
        arrival: flight.arrival,
        duration: flight.duration,
        userId: flight.userId,
        flightNumber: flight.flightNumber,
        aircraftId: null,
        airlineId: null,
        flightReason: null,
        note: null,
        trackingLink: null,
      })
      .execute();

    return { flight };
  },
};
