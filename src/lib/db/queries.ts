import { type Expression, type Kysely, sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

import type { DB } from './schema';
import type { CreateFlight } from './types';
import {
  flightTrackInputSchema,
  type FlightTrackInput,
  type FlightTrackPayload,
} from '$lib/track/schema';

const airportDisplayName = sql<string>`regexp_replace("name", '\\s+International(\\s+Airport)?$', ' Intl.', 'i')`;

const airportForClient = (db: Kysely<DB>) => {
  return db
    .selectFrom('airport')
    .select([
      'id',
      'icao',
      'iata',
      'lat',
      'lon',
      'tz',
      airportDisplayName.as('name'),
      'municipality',
      'type',
      'continent',
      'country',
      'custom',
    ]);
};

const airports = (
  db: Kysely<DB>,
  from: Expression<number | null>,
  to: Expression<number | null>,
) => {
  return [
    jsonObjectFrom(airportForClient(db).where('airport.id', '=', from)).as(
      'from',
    ),
    jsonObjectFrom(airportForClient(db).where('airport.id', '=', to)).as('to'),
  ];
};

const aircraft = (db: Kysely<DB>, id: Expression<number | null>) => {
  return jsonObjectFrom(
    db.selectFrom('aircraft').selectAll().where('aircraft.id', '=', id),
  ).as('aircraft');
};

const airline = (db: Kysely<DB>, id: Expression<number | null>) => {
  return jsonObjectFrom(
    db.selectFrom('airline').selectAll().where('airline.id', '=', id),
  ).as('airline');
};

const seats = (db: Kysely<DB>, flightId: Expression<number>) => {
  return jsonArrayFrom(
    db
      .selectFrom('seat')
      .selectAll('seat')
      .select(({ ref }) => [
        jsonObjectFrom(
          db
            .selectFrom('user')
            .select(['user.id', 'user.displayName', 'user.username'])
            .whereRef('user.id', '=', ref('seat.userId')),
        ).as('user'),
      ])
      .whereRef('seat.flightId', '=', flightId),
  ).as('seats');
};

export const listFlightBaseQuery = (db: Kysely<DB>, userId?: string) => {
  let query = db
    .selectFrom('flight')
    .selectAll('flight')
    .select((eb) =>
      airports(db, eb.ref('flight.fromId'), eb.ref('flight.toId')),
    )
    .select(({ ref }) => [aircraft(db, ref('flight.aircraftId'))])
    .select(({ ref }) => [airline(db, ref('flight.airlineId'))])
    .select((eb) => [seats(db, eb.ref('flight.id'))]);

  if (!userId) {
    return query;
  }

  query = query.where((eb) =>
    eb.exists(
      eb
        .selectFrom('seat')
        .select('seat.id')
        .whereRef('seat.flightId', '=', 'flight.id')
        .where('seat.userId', '=', userId),
    ),
  );

  return query;
};

export const listFlightPrimitive = async (db: Kysely<DB>, userId: string) => {
  const listQuery = listFlightBaseQuery(db, userId);

  return await listQuery.execute();
};

export const listAllFlightsPrimitive = async (db: Kysely<DB>) => {
  return await listFlightBaseQuery(db).execute();
};

export const getFlightPrimitive = async (db: Kysely<DB>, id: number) => {
  return await db
    .selectFrom('flight')
    .selectAll()
    .select(({ ref }) => airports(db, ref('flight.fromId'), ref('flight.toId')))
    .select(({ ref }) => [aircraft(db, ref('flight.aircraftId'))])
    .select(({ ref }) => [airline(db, ref('flight.airlineId'))])
    .select((eb) => [seats(db, eb.ref('flight.id'))])
    .where('id', '=', id)
    .executeTakeFirst();
};

export const createFlightPrimitive = async (
  db: Kysely<DB>,
  data: CreateFlight,
) => {
  return await db
    .transaction()
    .execute(async (trx) => createFlightPrimitiveWithConnection(trx, data));
};

export const updateFlightPrimitive = async (
  db: Kysely<DB>,
  id: number,
  data: CreateFlight,
) => {
  await db
    .transaction()
    .execute(async (trx) => updateFlightPrimitiveWithConnection(trx, id, data));
};

export const createFlightPrimitiveWithConnection = async (
  db: Kysely<DB>,
  data: CreateFlight,
) => {
  const { seats, from, to, aircraft, airline, track, ...flightData } = data;
  const fromId = from?.id ?? null;
  const toId = to?.id ?? null;
  const aircraftId = aircraft?.id ?? null;
  const airlineId = airline?.id ?? null;

  const resp = await db
    .insertInto('flight')
    .values({
      ...flightData,
      fromId,
      toId,
      aircraftId,
      airlineId,
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

  await db.insertInto('seat').values(seatData).executeTakeFirstOrThrow();

  if (track) {
    await upsertFlightTrackPrimitiveWithConnection(db, resp.id, track);
  }

  return resp.id;
};

export const updateFlightPrimitiveWithConnection = async (
  db: Kysely<DB>,
  id: number,
  data: CreateFlight,
) => {
  const { seats, from, to, aircraft, airline, track, ...flightData } = data;
  if (!from || !to) {
    throw new Error('Both departure and arrival airports are required');
  }
  if (!Number.isFinite(from.id) || !Number.isFinite(to.id)) {
    throw new Error('Both departure and arrival airports must have IDs');
  }
  const fromId = Number(from.id);
  const toId = Number(to.id);
  const aircraftId = aircraft?.id ?? null;
  const airlineId = airline?.id ?? null;

  await db
    .updateTable('flight')
    .set({
      ...flightData,
      fromId,
      toId,
      aircraftId,
      airlineId,
    })
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  if (track !== undefined) {
    if (track === null) {
      await deleteFlightTrackPrimitiveWithConnection(db, id);
    } else {
      await upsertFlightTrackPrimitiveWithConnection(db, id, track);
    }
  }

  if (!seats.length) return;

  await db.deleteFrom('seat').where('flightId', '=', id).execute();

  const seatData = seats.map((seat) => ({
    flightId: id,
    userId: seat.userId,
    guestName: seat.guestName,
    seat: seat.seat,
    seatNumber: seat.seatNumber,
    seatClass: seat.seatClass,
  }));

  await db.insertInto('seat').values(seatData).executeTakeFirstOrThrow();
};

const normalizeFlightTrackInput = (track: FlightTrackInput): FlightTrackInput =>
  flightTrackInputSchema.parse(track);

const toFlightTrackPayload = (track: FlightTrackInput): FlightTrackPayload => ({
  coordinates: track.coordinates,
  ...(track.times ? { times: track.times } : {}),
  ...(track.groundSpeedKt ? { groundSpeedKt: track.groundSpeedKt } : {}),
  ...(track.trackDeg ? { trackDeg: track.trackDeg } : {}),
});

export const upsertFlightTrackPrimitiveWithConnection = async (
  db: Kysely<DB>,
  flightId: number,
  track: FlightTrackInput,
) => {
  const validTrack = normalizeFlightTrackInput(track);
  const payload = toFlightTrackPayload(validTrack);

  await db
    .insertInto('flightTrack')
    .values({
      flightId,
      track: payload,
      sourceFormat: validTrack.sourceFormat,
      sourceName: validTrack.sourceName ?? null,
      pointCount: validTrack.coordinates.length,
      updatedAt: new Date(),
    })
    .onConflict((oc) =>
      oc.column('flightId').doUpdateSet({
        track: payload,
        sourceFormat: validTrack.sourceFormat,
        sourceName: validTrack.sourceName ?? null,
        pointCount: validTrack.coordinates.length,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }),
    )
    .executeTakeFirstOrThrow();
};

export const deleteFlightTrackPrimitiveWithConnection = async (
  db: Kysely<DB>,
  flightId: number,
) => {
  await db.deleteFrom('flightTrack').where('flightId', '=', flightId).execute();
};

export const createManyFlightsPrimitive = async (
  db: Kysely<DB>,
  data: CreateFlight[],
) => {
  await db.transaction().execute(async (trx) => {
    const flights = await trx
      .insertInto('flight')
      .values(
        data.map(
          ({
            seats: _,
            from,
            to,
            aircraft,
            airline,
            track: _track,
            ...rest
          }) => ({
            ...rest,
            fromId: from?.id ?? null,
            toId: to?.id ?? null,
            aircraftId: aircraft?.id ?? null,
            airlineId: airline?.id ?? null,
          }),
        ),
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

    const trackData = flights.flatMap((flight, index) => {
      const track = data[index]?.track
        ? normalizeFlightTrackInput(data[index].track)
        : null;
      if (!track) return [];
      return [
        {
          flightId: flight.id,
          track: toFlightTrackPayload(track),
          sourceFormat: track.sourceFormat,
          sourceName: track.sourceName ?? null,
          pointCount: track.coordinates.length,
          updatedAt: new Date(),
        },
      ];
    });

    if (trackData.length) {
      await trx.insertInto('flightTrack').values(trackData).execute();
    }
  });
};

export const findAirportsPrimitive = async (db: Kysely<DB>, input: string) => {
  const namePattern = `%${input}%`;
  return await db
    .selectFrom('airport')
    .select([
      'id',
      'icao',
      'iata',
      'lat',
      'lon',
      'tz',
      airportDisplayName.as('name'),
      'municipality',
      'type',
      'continent',
      'country',
      'custom',
    ])
    .where((qb) =>
      qb.or([
        qb('icao', 'ilike', input),
        qb('iata', 'ilike', input),
        sql<boolean>`unaccent("name") ILIKE unaccent(${namePattern})` as any,
      ]),
    )
    .select([
      sql`CASE
              WHEN "icao" ILIKE ${input} THEN 1
              WHEN "iata" ILIKE ${input} THEN 1
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
    .orderBy('match_rank', 'asc')
    .orderBy('type_rank', 'asc')
    .limit(10)
    .execute();
};
