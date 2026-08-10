import { type Expression, type Kysely, type Selectable, sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

import type { DB } from './schema';
import type { CreateFlight, CreateFlightPassenger } from './types';

import {
  flightTrackInputSchema,
  toFlightTrackPayload,
  type FlightTrackInput,
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

type ExistingPassengerIdentity = Pick<
  Selectable<DB['flightPassenger']>,
  'id' | 'userId' | 'guestName'
>;

const passengerIdentity = (passenger: {
  userId: string | null;
  guestName: string | null;
}) =>
  passenger.userId
    ? `user:${passenger.userId}`
    : `guest:${passenger.guestName}`;

export const resolveFlightPassengerChanges = (
  existingPassengers: ExistingPassengerIdentity[],
  incomingPassengers: CreateFlightPassenger[],
) => {
  const byId = new Map(
    existingPassengers.map((passenger) => [passenger.id, passenger]),
  );
  const byIdentity = new Map(
    existingPassengers.map((passenger) => [
      passengerIdentity(passenger),
      passenger,
    ]),
  );
  const retainedIds = new Set<number>();
  const resolved = incomingPassengers.map((passenger) => {
    const existing = passenger.id
      ? byId.get(passenger.id)
      : byIdentity.get(passengerIdentity(passenger));
    if (passenger.id && !existing) {
      throw new Error('Passenger does not belong to this flight');
    }
    if (existing && retainedIds.has(existing.id)) {
      throw new Error('Passenger record appears more than once');
    }
    if (existing) retainedIds.add(existing.id);
    return { passenger, existing };
  });
  const removedIds = existingPassengers
    .filter((passenger) => !retainedIds.has(passenger.id))
    .map((passenger) => passenger.id);

  return { resolved, removedIds };
};

const passengers = (db: Kysely<DB>, flightId: Expression<number>) => {
  return jsonArrayFrom(
    db
      .selectFrom('flightPassenger')
      .selectAll('flightPassenger')
      .select(({ ref }) => [
        jsonObjectFrom(
          db
            .selectFrom('user')
            .select(['user.id', 'user.displayName', 'user.username'])
            .whereRef('user.id', '=', ref('flightPassenger.userId')),
        ).as('user'),
      ])
      .whereRef('flightPassenger.flightId', '=', flightId),
  ).as('passengers');
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
    .select((eb) => [passengers(db, eb.ref('flight.id'))]);

  if (!userId) {
    return query;
  }

  query = query.where((eb) =>
    eb.exists(
      eb
        .selectFrom('flightPassenger')
        .select('flightPassenger.id')
        .whereRef('flightPassenger.flightId', '=', 'flight.id')
        .where('flightPassenger.userId', '=', userId),
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
    .select((eb) => [passengers(db, eb.ref('flight.id'))])
    .where('id', '=', id)
    .executeTakeFirst();
};

export const createFlightPrimitive = async (
  db: Kysely<DB>,
  data: CreateFlight,
) => {
  return await db.transaction().execute(async (trx) => {
    const result = await createFlightPrimitiveWithConnection(trx, data);
    return result.flightId;
  });
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
  if (!data.passengers.length) {
    throw new Error('Flight must have at least one passenger');
  }

  const { passengers, from, to, aircraft, airline, track, ...flightData } =
    data;
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

  const persistedPassengers: Array<{
    id: number;
    input: CreateFlightPassenger;
  }> = [];
  for (const passenger of passengers) {
    const created = await db
      .insertInto('flightPassenger')
      .values({
        flightId: resp.id,
        userId: passenger.userId,
        guestName: passenger.guestName,
        seat: passenger.seat,
        seatNumber: passenger.seatNumber,
        seatClass: passenger.seatClass,
        flightReason: passenger.flightReason,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    persistedPassengers.push({ id: created.id, input: passenger });
  }

  if (track) {
    await upsertFlightTrackPrimitiveWithConnection(db, resp.id, track);
  }

  return {
    flightId: resp.id,
    passengers: persistedPassengers,
  };
};

export const updateFlightPrimitiveWithConnection = async (
  db: Kysely<DB>,
  id: number,
  data: CreateFlight,
) => {
  const { passengers, from, to, aircraft, airline, track, ...flightData } =
    data;
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

  if (!passengers.length) return [];

  const existingPassengers = await db
    .selectFrom('flightPassenger')
    .select(['id', 'userId', 'guestName'])
    .where('flightId', '=', id)
    .execute();
  const { resolved, removedIds } = resolveFlightPassengerChanges(
    existingPassengers,
    passengers,
  );
  if (removedIds.length) {
    await db
      .deleteFrom('flightPassenger')
      .where('id', 'in', removedIds)
      .execute();
  }

  const persistedPassengers: Array<{
    id: number;
    input: CreateFlightPassenger;
  }> = [];
  for (const { passenger, existing } of resolved) {
    const values = {
      userId: passenger.userId,
      guestName: passenger.guestName,
      seat: passenger.seat,
      seatNumber: passenger.seatNumber,
      seatClass: passenger.seatClass,
      flightReason: passenger.flightReason,
    };
    if (existing) {
      await db
        .updateTable('flightPassenger')
        .set(values)
        .where('id', '=', existing.id)
        .executeTakeFirstOrThrow();
      persistedPassengers.push({ id: existing.id, input: passenger });
    } else {
      const created = await db
        .insertInto('flightPassenger')
        .values({ ...values, flightId: id })
        .returning('id')
        .executeTakeFirstOrThrow();
      persistedPassengers.push({ id: created.id, input: passenger });
    }
  }
  return persistedPassengers;
};

const normalizeFlightTrackInput = (track: FlightTrackInput): FlightTrackInput =>
  flightTrackInputSchema.parse(track);

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
  if (data.some((flight) => !flight.passengers.length)) {
    throw new Error('Every flight must have at least one passenger');
  }

  await db.transaction().execute(async (trx) => {
    const flights = await trx
      .insertInto('flight')
      .values(
        data.map(
          ({
            passengers: _,
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

    const passengerData = flights.flatMap((flight, index) => {
      const flightInput = data[index];

      if (flightInput && flightInput.passengers.length > 0) {
        return flightInput.passengers.map((passenger) => ({
          flightId: flight.id,
          userId: passenger.userId,
          guestName: passenger.guestName,
          seat: passenger.seat,
          seatNumber: passenger.seatNumber,
          seatClass: passenger.seatClass,
          flightReason: passenger.flightReason,
        }));
      }

      return [];
    });

    await trx.insertInto('flightPassenger').values(passengerData).execute();

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
