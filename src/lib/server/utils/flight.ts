import type { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

import { db } from '$lib/db';
import type { DB } from '$lib/db/schema';
import type { CreateFlight } from '$lib/db/types';

export const listFlights = async (userId: string) => {
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

export const getFlight = async (id: number) => {
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

export const createFlight = async (data: CreateFlight) => {
  await createFlightPrimitive(db, data);
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

export const deleteFlight = async (id: number) => {
  return await db.deleteFrom('flight').where('id', '=', id).executeTakeFirst();
};

export const updateFlight = async (id: number, data: CreateFlight) => {
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
