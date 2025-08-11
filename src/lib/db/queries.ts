import { type Expression, type Kysely, sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

import type { DB } from './schema';
import type { CreateFlight } from './types';

const airports = (
  db: Kysely<DB>,
  from: Expression<string>,
  to: Expression<string>,
) => {
  return [
    jsonObjectFrom(
      db.selectFrom('airport').where('airport.code', '=', from).selectAll(),
    ).as('from'),
    jsonObjectFrom(
      db.selectFrom('airport').where('airport.code', '=', to).selectAll(),
    ).as('to'),
  ];
};

export const listFlightPrimitive = async (db: Kysely<DB>, userId: string) => {
  return await db
    .selectFrom('flight')
    .selectAll('flight')
    .select((eb) => airports(db, eb.ref('flight.from'), eb.ref('flight.to')))
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
    .select(({ ref }) => airports(db, ref('flight.from'), ref('flight.to')))
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
  return await db.transaction().execute(async (trx) => {
    const { seats, ...flightData } = data;
    const resp = await trx
      .insertInto('flight')
      .values({
        ...flightData,
        from: flightData.from.code,
        to: flightData.to.code,
      })
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
    return resp.id;
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
      .set({
        ...flightData,
        from: flightData.from.code,
        to: flightData.to.code,
      })
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
      .values(
        data.map(({ seats: _, ...rest }) => ({
          ...rest,
          from: rest.from.code,
          to: rest.to.code,
        })),
      )
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

export const findAirportsPrimitive = async (db: Kysely<DB>, input: string) => {
  const namePattern = `%${input}%`;
  return await db
    .selectFrom('airport')
    .selectAll()
    .where((qb) =>
      qb.or([
        qb('iata', 'ilike', input),
        qb('code', 'ilike', input),
        sql<boolean>`unaccent("name") ILIKE unaccent(${namePattern})` as any,
      ]),
    )
    .select([
      sql`CASE
              WHEN "iata" ILIKE ${input} THEN 1
              WHEN "code" ILIKE ${input} THEN 1
              WHEN unaccent("name") ILIKE unaccent(${namePattern}) THEN 2
              ELSE 3
            END`.as('match_rank'),
      sql`CASE
            WHEN "type" = 'closed' THEN 7
            WHEN "type" = 'heliport' THEN 6
            WHEN "type" = 'balloonport' THEN 5
            WHEN "type" = 'seaplane_base' THEN 4
            WHEN "type" = 'small_airport' THEN 3
            WHEN "type" = 'medium_airport' THEN 2
            WHEN "type" = 'large_airport' THEN 1
            ELSE 8
          END`.as('type_rank'),
    ])
    .orderBy('match_rank asc')
    .orderBy('type_rank asc')
    .limit(10)
    .execute();
};
