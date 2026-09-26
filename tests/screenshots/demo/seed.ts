import { createHash, randomUUID } from 'node:crypto';

import { hash } from '@node-rs/argon2';
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

import type { DB } from '../../../src/lib/db/schema';
import {
  presets,
  type PresetKey,
} from '../../../src/lib/utils/preferences/presets';
import { ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from './accounts';
import {
  DEMO_NOW,
  EXTRA_COUNTRIES,
  TRIPS,
  type Companion,
  type Leg,
} from './itinerary';
import { estimatedDuration, syntheticTrack } from './track';

/** When the demo instance was set up; backdates rows created while seeding. */
const DEMO_ACCOUNT_CREATED = new Date('2024-11-03T10:00:00Z');

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
  'reference_data.read',
  'flight.create.any',
  'flight.passengers.manage.any',
  'tracks.write',
  'visited_countries.write',
  'shares.write',
  'roles.manage',
];

const sha256 = (value: string) =>
  createHash('sha256').update(value.normalize('NFKC')).digest('base64');

const passwordHash = (password: string) =>
  hash(password.normalize('NFKC'), {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

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

type Airport = {
  id: number;
  iata: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
};

export const seedDemo = async ({
  baseUrl,
  databaseUrl,
}: {
  baseUrl: string;
  databaseUrl: string;
}) => {
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: databaseUrl }),
    }),
    plugins: [new CamelCasePlugin()],
  });

  try {
    const password = await passwordHash(DEMO_PASSWORD);
    const ids = Object.fromEntries(
      Object.keys(ACCOUNTS).map((key) => [key, randomUUID().slice(0, 15)]),
    ) as Record<DemoAccount, string>;

    const roleIds = {
      user: 'role-user',
      administrator: 'role-administrator',
    };
    const users: {
      key: DemoAccount;
      roleId: string | null;
      isOwner?: boolean;
      preset: PresetKey;
    }[] = [
      { key: 'maya', roleId: null, isOwner: true, preset: 'metric' },
      { key: 'jonas', roleId: roleIds.user, preset: 'metric' },
      { key: 'ella', roleId: roleIds.user, preset: 'metric' },
      { key: 'noah', roleId: roleIds.administrator, preset: 'aviation' },
      { key: 'sam', roleId: roleIds.user, preset: 'imperial' },
    ];
    await db
      .insertInto('user')
      .values(
        users.map(({ key, roleId, isOwner, preset }) => ({
          ...presets[preset].values,
          id: ids[key],
          username: ACCOUNTS[key].username,
          displayName: ACCOUNTS[key].displayName,
          password,
          roleId,
          isOwner: isOwner ?? false,
        })),
      )
      .execute();

    const seedKey = `seed_${randomUUID()}`;
    const seedKeyRow = await db
      .insertInto('apiKey')
      .values({
        name: 'demo seed',
        userId: ids.maya,
        key: sha256(seedKey),
        scopes: SEED_SCOPES,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${seedKey}`,
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
      if (!response.ok)
        throw new Error(
          `${init?.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`,
        );
      return response.status === 204
        ? (undefined as T)
        : ((await response.json()) as { data: T }).data;
    };

    // Reference data -------------------------------------------------------
    const airports = new Map<string, Airport>();
    const codes = new Set(
      TRIPS.flatMap((t) => t.legs.flatMap((l) => [l.from, l.to])),
    );
    for (const code of codes) {
      const matches = await api<Airport[]>(`/airports?query=${code}`);
      const match = matches.find((airport) => airport.iata === code);
      if (!match) throw new Error(`Airport ${code} not found`);
      airports.set(code, match);
    }

    const airlineIds = new Map<string, number>();
    for (const [icao, [name, iata]] of Object.entries(AIRLINE_NAMES)) {
      const found = await db
        .selectFrom('airline')
        .select('id')
        .where('icao', '=', icao)
        .executeTakeFirst();
      const row =
        found ??
        (await db
          .insertInto('airline')
          .values({ name, icao, iata })
          .returning('id')
          .executeTakeFirstOrThrow());
      airlineIds.set(icao, row.id);
    }

    const aircraftIds = new Map<string, number>();
    for (const [icao, name] of Object.entries(AIRCRAFT_NAMES)) {
      const found = await db
        .selectFrom('aircraft')
        .select('id')
        .where('icao', '=', icao)
        .executeTakeFirst();
      const row =
        found ??
        (await db
          .insertInto('aircraft')
          .values({ name, icao })
          .returning('id')
          .executeTakeFirstOrThrow());
      aircraftIds.set(icao, row.id);
    }

    // Custom fields ---------------------------------------------------------
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

    // Flights -----------------------------------------------------------------
    const companionIds: Record<Companion, string> = {
      jonas: ids.jonas,
      ella: ids.ella,
    };
    const createLeg = async (leg: Leg, reason: string, with_: Companion[]) => {
      const from = airports.get(leg.from)!;
      const to = airports.get(leg.to)!;
      const origin = { lat: from.latitude, lon: from.longitude };
      const destination = { lat: to.latitude, lon: to.longitude };
      const departure = zonedToUtc(leg.departs, from.timezone);
      const duration = estimatedDuration(origin, destination);
      const arrival = new Date(departure.getTime() + duration * 1000);
      const passenger = (userId: string, offset: number) => ({
        userId,
        guestName: null,
        seat:
          offset === 0 ? (leg.seat ?? null) : offset === 1 ? 'middle' : 'aisle',
        seatNumber:
          offset === 0
            ? (leg.seatNumber ?? null)
            : nextSeat(leg.seatNumber, offset),
        seatClass: leg.seatClass ?? 'economy',
        flightReason: reason,
        customFields: { meal: offset === 0 ? 'Vegetarian' : 'Standard' },
      });

      await api('/flights', {
        method: 'POST',
        body: JSON.stringify({
          date: leg.departs.slice(0, 10),
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
            ? {
                track: syntheticTrack(origin, destination, departure, duration),
              }
            : {}),
        }),
      });
    };

    for (const trip of TRIPS) {
      for (const leg of trip.legs) {
        await createLeg(leg, trip.reason, trip.with ?? []);
      }
    }

    // Visited countries --------------------------------------------------------
    // A country counts as visited when a trip stays there overnight, and as a
    // layover when it is only passed through on the way.
    const countries = new Map<string, 'visited' | 'layover'>();
    for (const trip of TRIPS) {
      trip.legs.forEach((leg, i) => {
        const country = airports.get(leg.to)!.country;
        const next = trip.legs[i + 1];
        const stays =
          !next || next.departs.slice(0, 10) !== leg.departs.slice(0, 10);
        if (stays) countries.set(country, 'visited');
        else if (!countries.has(country)) countries.set(country, 'layover');
      });
    }
    for (const [code, status] of countries) {
      await api('/visited-countries', {
        method: 'PUT',
        body: JSON.stringify({ code, status }),
      });
    }
    for (const entry of EXTRA_COUNTRIES) {
      await api('/visited-countries', {
        method: 'PUT',
        body: JSON.stringify({ note: null, ...entry }),
      });
    }

    // Sharing, roles, credentials ------------------------------------------------
    await api('/shares', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'maya-travels',
        showMap: true,
        showStats: true,
        showFlightList: true,
        showTracks: true,
      }),
    });

    await api('/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Family viewer',
        description: 'See everyone’s flights without changing them.',
        permissions: [
          'flight.read.any',
          'flight.export.own',
          'users.directory.read',
        ],
      }),
    });

    await db.deleteFrom('apiKey').where('id', '=', seedKeyRow.id).execute();
    await db
      .insertInto('apiKey')
      .values([
        {
          name: 'Home Assistant',
          userId: ids.maya,
          key: sha256(randomUUID()),
          scopes: ['profile.read', 'flight.read.own', 'stats.read'],
          createdAt: new Date('2025-09-02T18:00:00Z'),
          lastUsed: new Date('2026-06-15T06:00:00Z'),
        },
        {
          name: 'Nightly backup',
          userId: ids.maya,
          key: sha256(randomUUID()),
          scopes: ['flight.export.own'],
          createdAt: new Date('2025-01-11T09:30:00Z'),
          lastUsed: new Date('2026-06-15T02:00:00Z'),
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
        resource: `${baseUrl}/api/mcp`,
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

    // Rows created just now would read as dated after the frozen demo clock.
    const { rows } = await sql<{ table: string }>`
      select table_name as table from information_schema.columns
      where table_schema = 'public' and column_name = 'created_at'
    `.execute(db);
    for (const { table } of rows)
      await sql`
        update ${sql.table(table)} set created_at = ${DEMO_ACCOUNT_CREATED}
        where created_at > ${DEMO_NOW}
      `.execute(db);

    return { flights: TRIPS.reduce((n, t) => n + t.legs.length, 0) };
  } finally {
    await db.destroy();
  }
};
