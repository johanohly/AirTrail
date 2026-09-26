import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import { env } from '$env/dynamic/private';
import {
  flightInputSchema,
  shareInputSchema,
  visitedCountryInputSchema,
} from '$lib/api/v1/schemas';
import type { ApiScope } from '$lib/api/v1/scopes';
import { PERMISSIONS } from '$lib/authorization/permissions';
import { db } from '$lib/db';
import { publicUserFields, type User } from '$lib/db/types';
import type { ApiPrincipal } from '$lib/server/api/v1/principal';
import { createFlight } from '$lib/server/api/v1/services/flights';
import {
  createShare,
  setVisitedCountry,
} from '$lib/server/api/v1/services/personal';
import { loadAuthorizationContext } from '$lib/server/authorization/context';
import { createRole } from '$lib/server/authorization/roles';
import { hashArgon2, hashSha256 } from '$lib/server/utils/hash';
import { presets, type PresetKey } from '$lib/utils/preferences/presets';

import { ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from './accounts';
import {
  DEMO_NOW,
  EXTRA_COUNTRIES,
  TRIPS,
  type Companion,
  type Leg,
} from './itinerary';
import { demoMode, DEMO_DENIED_PERMISSIONS } from './mode';
import { estimatedDuration, syntheticTrack } from './track';

const DAY = 24 * 60 * 60 * 1000;

/** When Maya started using AirTrail, as written in the itinerary. */
const ACCOUNT_CREATED = new Date('2024-11-03T10:00:00Z');

const AIRLINE_NAMES: Record<string, [string, string]> = {
  AFR: ['Air France', 'AF'],
  BAW: ['British Airways', 'BA'],
  DLH: ['Lufthansa', 'LH'],
  EZY: ['easyJet', 'U2'],
  FIN: ['Finnair', 'AY'],
  IBE: ['Iberia', 'IB'],
  ICE: ['Icelandair', 'FI'],
  KLM: ['KLM', 'KL'],
  NOZ: ['Norwegian', 'D8'],
  QTR: ['Qatar Airways', 'QR'],
  RYR: ['Ryanair', 'FR'],
  SAS: ['SAS', 'SK'],
  SIA: ['Singapore Airlines', 'SQ'],
  SWR: ['Swiss', 'LX'],
  TAP: ['TAP Air Portugal', 'TP'],
  THY: ['Turkish Airlines', 'TK'],
  UAE: ['Emirates', 'EK'],
  UAL: ['United Airlines', 'UA'],
};

const AIRCRAFT_NAMES: Record<string, string> = {
  A20N: 'Airbus A320neo',
  A320: 'Airbus A320',
  A321: 'Airbus A321',
  A333: 'Airbus A330-300',
  A359: 'Airbus A350-900',
  A388: 'Airbus A380-800',
  B38M: 'Boeing 737 MAX 8',
  B738: 'Boeing 737-800',
  B763: 'Boeing 767-300',
  B77W: 'Boeing 777-300ER',
  B789: 'Boeing 787-9',
  CRJ9: 'Bombardier CRJ900',
  E195: 'Embraer E195',
};

const SEED_SCOPES = [
  'flight.create.any',
  'flight.passengers.manage.any',
  'tracks.write',
  'visited_countries.write',
  'shares.write',
] as ApiScope[];

/*
 * A public demo moves the whole itinerary forward by whole weeks, so the most
 * recent trip is days rather than months old and weekdays stay the same.
 * Screenshots keep the dates as written.
 */
const itineraryOffsetDays = () => {
  if (demoMode() !== 'public') return 0;
  const weeks = Math.floor((Date.now() - DEMO_NOW.getTime()) / (7 * DAY));
  return weeks * 7;
};

/** `YYYY-MM-DD HH:mm` moved by whole days. */
const shiftLocal = (local: string, days: number) => {
  const [date, time] = local.split(' ');
  const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY);
  return `${shifted.toISOString().slice(0, 10)} ${time}`;
};

/** The UTC instant of a wall-clock time in an IANA zone. */
const zonedToUtc = (local: string, timeZone: string) => {
  const [date, time] = local.split(' ');
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(guess)
      .map((part) => [part.type, part.value]),
  );
  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(guess.getTime() - (asZoned - guess.getTime()));
};

/** The seat next to `seatNumber`, for a companion. */
const nextSeat = (seatNumber: string | undefined, offset: number) => {
  if (!seatNumber) return null;
  const row = seatNumber.slice(0, -1);
  const letter = seatNumber.slice(-1).charCodeAt(0);
  const step = letter <= 'D'.charCodeAt(0) ? offset : -offset;
  return `${row}${String.fromCharCode(letter + step)}`;
};

const loadPrincipal = async (userId: string): Promise<ApiPrincipal> => {
  const user = (await db
    .selectFrom('user')
    .select([...publicUserFields, 'oauthId'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()) as unknown as User;
  const authorization = await loadAuthorizationContext(userId);
  if (!authorization) throw new Error(`No authorization for ${userId}`);
  return {
    user,
    authorization,
    credential: { kind: 'apiKey', keyId: 0, scopes: new Set(SEED_SCOPES) },
  };
};

const findAirport = async (iata: string) => {
  const airport = await db
    .selectFrom('airport')
    .select(['id', 'lat', 'lon', 'tz', 'country'])
    .where('iata', '=', iata)
    .where('type', '!=', 'closed')
    .orderBy('type')
    .executeTakeFirst();
  if (!airport) throw new Error(`Airport ${iata} not found`);
  return airport;
};

const ensureAirline = async (icao: string, [name, iata]: [string, string]) => {
  const found = await db
    .selectFrom('airline')
    .select('id')
    .where('icao', '=', icao)
    .executeTakeFirst();
  if (found) return found.id;
  const row = await db
    .insertInto('airline')
    .values({ name, icao, iata })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
};

const ensureAircraft = async (icao: string, name: string) => {
  const found = await db
    .selectFrom('aircraft')
    .select('id')
    .where('icao', '=', icao)
    .executeTakeFirst();
  if (found) return found.id;
  const row = await db
    .insertInto('aircraft')
    .values({ name, icao })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
};

/*
 * Builds the demo world through the same services the REST API uses, so the
 * data goes through the same validation as a real client's. Runs only on an
 * empty database.
 */
export const seedDemo = async () => {
  const mode = demoMode();
  const offset = itineraryOffsetDays();
  const now = new Date(DEMO_NOW.getTime() + offset * DAY);
  const shifted = (date: string) => new Date(Date.parse(date) + offset * DAY);

  const password = await hashArgon2(DEMO_PASSWORD);
  const ids = Object.fromEntries(
    Object.keys(ACCOUNTS).map((key) => [key, randomUUID().slice(0, 15)]),
  ) as Record<DemoAccount, string>;

  const insertUser = (
    key: DemoAccount,
    roleId: string | null,
    preset: PresetKey,
    isOwner = false,
  ) =>
    db
      .insertInto('user')
      .values({
        ...presets[preset].values,
        id: ids[key],
        username: ACCOUNTS[key].username,
        displayName: ACCOUNTS[key].displayName,
        password,
        roleId,
        isOwner,
      })
      .execute();

  // A public demo keeps the owner out of reach: the owner bypasses every
  // permission, including the ones a demo takes away. Visitors get a role that
  // can do everything else, so users and roles can still be tried out.
  if (mode === 'public') {
    const ownerId = randomUUID().slice(0, 15);
    await db
      .insertInto('user')
      .values({
        ...presets.metric.values,
        id: ownerId,
        username: 'owner',
        displayName: 'Instance owner',
        password: await hashArgon2(randomUUID()),
        roleId: null,
        isOwner: true,
      })
      .execute();
    const owner = await loadAuthorizationContext(ownerId);
    const roleId = await createRole(
      {
        name: 'Household admin',
        description: 'Manages the household’s flights, people and roles.',
        permissions: PERMISSIONS.filter(
          (permission) => !DEMO_DENIED_PERMISSIONS.includes(permission),
        ),
      },
      owner!,
    );
    await insertUser('maya', roleId, 'metric');
  } else {
    await insertUser('maya', null, 'metric', true);
  }
  await insertUser('jonas', 'role-user', 'metric');
  await insertUser('ella', 'role-user', 'metric');
  await insertUser('noah', 'role-administrator', 'aviation');
  await insertUser('sam', 'role-user', 'imperial');

  const maya = await loadPrincipal(ids.maya);

  // Reference data -----------------------------------------------------------
  const codes = new Set(
    TRIPS.flatMap((trip) => trip.legs.flatMap((leg) => [leg.from, leg.to])),
  );
  const airports = new Map(
    await Promise.all(
      [...codes].map(async (code) => [code, await findAirport(code)] as const),
    ),
  );
  const airlineIds = new Map<string, number>();
  for (const [icao, names] of Object.entries(AIRLINE_NAMES))
    airlineIds.set(icao, await ensureAirline(icao, names));
  const aircraftIds = new Map<string, number>();
  for (const [icao, name] of Object.entries(AIRCRAFT_NAMES))
    aircraftIds.set(icao, await ensureAircraft(icao, name));

  await db
    .insertInto('customFieldDefinition')
    .values([
      {
        entityType: 'flight',
        key: 'booking_reference',
        label: 'Booking reference',
        fieldType: 'text',
        order: 0,
        updatedAt: new Date(),
      },
      {
        entityType: 'flight_passenger',
        key: 'meal',
        label: 'Meal',
        fieldType: 'select',
        options: JSON.stringify(['Standard', 'Vegetarian', 'Vegan']),
        order: 0,
        updatedAt: new Date(),
      },
    ])
    .execute();

  // Flights ------------------------------------------------------------------
  const companionIds: Record<Companion, string> = {
    jonas: ids.jonas,
    ella: ids.ella,
  };
  const createLeg = async (leg: Leg, reason: string, with_: Companion[]) => {
    const departs = shiftLocal(leg.departs, offset);
    const from = airports.get(leg.from)!;
    const to = airports.get(leg.to)!;
    const origin = { lat: from.lat, lon: from.lon };
    const destination = { lat: to.lat, lon: to.lon };
    const departure = zonedToUtc(departs, from.tz);
    const duration = estimatedDuration(origin, destination);
    const arrival = new Date(departure.getTime() + duration * 1000);
    const passenger = (userId: string, position: number) => ({
      userId,
      guestName: null,
      seat:
        position === 0
          ? (leg.seat ?? null)
          : position === 1
            ? 'middle'
            : 'aisle',
      seatNumber:
        position === 0
          ? (leg.seatNumber ?? null)
          : nextSeat(leg.seatNumber, position),
      seatClass: leg.seatClass ?? 'economy',
      flightReason: reason,
      customFields: { meal: position === 0 ? 'Vegetarian' : 'Standard' },
    });

    await createFlight(
      maya,
      flightInputSchema.parse({
        date: departs.slice(0, 10),
        departure: departure.toISOString(),
        arrival: arrival.toISOString(),
        duration,
        flightNumber: leg.flightNumber,
        aircraftReg: leg.registration ?? null,
        note: leg.note ?? null,
        fromId: from.id,
        toId: to.id,
        airlineId: airlineIds.get(leg.airline) ?? null,
        aircraftId: aircraftIds.get(leg.aircraft) ?? null,
        passengers: [
          passenger(ids.maya, 0),
          ...with_.map((companion, i) =>
            passenger(companionIds[companion], i + 1),
          ),
        ],
        customFields: leg.bookingReference
          ? { booking_reference: leg.bookingReference }
          : {},
        ...(leg.track
          ? { track: syntheticTrack(origin, destination, departure, duration) }
          : {}),
      }),
    );
  };

  for (const trip of TRIPS)
    for (const leg of trip.legs)
      await createLeg(leg, trip.reason, trip.with ?? []);

  // Visited countries --------------------------------------------------------
  // A country counts as visited when a past trip stays there overnight, and as
  // a layover when it is only passed through on the way.
  const countries = new Map<string, 'visited' | 'layover'>();
  const itineraryNow = DEMO_NOW.toISOString().slice(0, 16).replace('T', ' ');
  for (const trip of TRIPS) {
    trip.legs.forEach((leg, i) => {
      if (leg.departs > itineraryNow) return;
      const country = airports.get(leg.to)!.country;
      const next = trip.legs[i + 1];
      const stays =
        !next || next.departs.slice(0, 10) !== leg.departs.slice(0, 10);
      if (stays) countries.set(country, 'visited');
      else if (!countries.has(country)) countries.set(country, 'layover');
    });
  }
  for (const [code, status] of countries)
    await setVisitedCountry(
      maya,
      visitedCountryInputSchema.parse({ code, status }),
    );
  for (const entry of EXTRA_COUNTRIES)
    await setVisitedCountry(
      maya,
      visitedCountryInputSchema.parse({ note: null, ...entry }),
    );

  // Sharing, roles, credentials ---------------------------------------------
  await createShare(
    maya,
    shareInputSchema.parse({
      slug: 'maya-travels',
      showMap: true,
      showStats: true,
      showFlightList: true,
      showTracks: true,
    }),
  );

  await createRole(
    {
      name: 'Family viewer',
      description: 'See everyone’s flights without changing them.',
      permissions: [
        'flight.read.any',
        'flight.export.own',
        'users.directory.read',
      ],
    },
    maya.authorization,
  );

  await db
    .insertInto('apiKey')
    .values([
      {
        name: 'Home Assistant',
        userId: ids.maya,
        key: hashSha256(randomUUID()),
        scopes: ['profile.read', 'flight.read.own', 'stats.read'],
        createdAt: shifted('2025-09-02T18:00:00Z'),
        lastUsed: shifted('2026-06-15T06:00:00Z'),
      },
      {
        name: 'Nightly backup',
        userId: ids.maya,
        key: hashSha256(randomUUID()),
        scopes: ['flight.export.own'],
        createdAt: shifted('2025-01-11T09:30:00Z'),
        lastUsed: shifted('2026-06-15T02:00:00Z'),
      },
    ])
    .execute();

  const clientId = `client_${randomUUID()}`;
  await db
    .insertInto('oauthClient')
    .values({ id: clientId, name: 'Claude', tokenEndpointAuthMethod: 'none' })
    .execute();
  await db
    .insertInto('oauthGrant')
    .values({
      id: randomUUID(),
      clientId,
      userId: ids.maya,
      resource: `${env.ORIGIN ?? ''}/api/mcp`,
      scopes: [
        'profile.read',
        'flight.read.own',
        'reference_data.read',
        'stats.read',
        'tracks.read',
        'visited_countries.read',
      ],
    })
    .execute();

  // Rows created just now would read as dated after the demo's "today".
  const { rows } = await sql<{ table: string }>`
    select table_name as table from information_schema.columns
    where table_schema = 'public' and column_name = 'created_at'
  `.execute(db);
  const created = new Date(ACCOUNT_CREATED.getTime() + offset * DAY);
  for (const { table } of rows)
    await sql`
      update ${sql.table(table)} set created_at = ${created}
      where created_at > ${now}
    `.execute(db);

  return { flights: TRIPS.reduce((n, trip) => n + trip.legs.length, 0) };
};
