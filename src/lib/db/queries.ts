import type { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

import type { DB } from './schema';
import type { CreateFlight } from './types';

import { db } from '$lib/db/index';

export const listFlightPrimitive = async (db: Kysely<DB>, userId: string) => {
  return await db
    .selectFrom('flight')
    .selectAll('flight')
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom('seat')
          .selectAll()
          .whereRef('seat.flightId', '=', 'flight.id'),
      ).as('seats'),
    ])
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('seat')
          .select('seat.id')
          .whereRef('seat.flightId', '=', 'flight.id')
          .where('seat.userId', '=', userId),
      ),
    )
    .execute();
};

export const getFlightPrimitive = async (db: Kysely<DB>, id: number) => {
  return await db
    .selectFrom('flight')
    .selectAll()
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('seat')
          .selectAll()
          .whereRef('seat.flightId', '=', 'flight.id'),
      ).as('seats'),
    )
    .where('id', '=', id)
    .executeTakeFirst();
};

export const createFlightPrimitive = async (
  db: Kysely<DB>,
  data: CreateFlight,
) => {
  await db.transaction().execute(async (trx) => {
    const { seats, ...flightData } = data;
    const resp = await trx
      .insertInto('flight')
      .values(flightData)
      .returning('id')
      .executeTakeFirstOrThrow();

    const seatData = seats.map((seat) => ({
      flightId: resp.id,
      userId: seat.userId,
      guestName: seat.guestName,
      seat: seat.seat,
      seatNumber: seat.seatNumber,
      seatClass: seat.seatClass,
    }));

    await trx.insertInto('seat').values(seatData).executeTakeFirstOrThrow();
  });
};

export const updateFlightPrimitive = async (
  db: Kysely<DB>,
  id: number,
  data: CreateFlight,
) => {
  await db.transaction().execute(async (trx) => {
    const { seats, ...flightData } = data;
    await trx
      .updateTable('flight')
      .set(flightData)
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

    if (seats.length) {
      await trx.deleteFrom('seat').where('flightId', '=', id).execute();

      const seatData = seats.map((seat) => ({
        flightId: id,
        userId: seat.userId,
        guestName: seat.guestName,
        seat: seat.seat,
        seatNumber: seat.seatNumber,
        seatClass: seat.seatClass,
      }));

      await trx.insertInto('seat').values(seatData).executeTakeFirstOrThrow();
    }
  });
};

export const createManyFlightsPrimitive = async (
  db: Kysely<DB>,
  data: CreateFlight[],
) => {
  await db.transaction().execute(async (trx) => {
    const flights = await trx
      .insertInto('flight')
      .values(data.map(({ seats: _, ...rest }) => rest))
      .returning('id')
      .execute();

    const seatData = flights.flatMap((flight, index) => {
      const flightInput = data[index];

      if (flightInput && flightInput.seats.length > 0) {
        return flightInput.seats.map((seat) => ({
          flightId: flight.id,
          userId: seat.userId,
          guestName: seat.guestName,
          seat: seat.seat,
          seatNumber: seat.seatNumber,
          seatClass: seat.seatClass,
        }));
      }

      return [];
    });

    await trx.insertInto('seat').values(seatData).execute();
  });
};
