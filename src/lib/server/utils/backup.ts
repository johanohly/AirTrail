import { db } from '$lib/db';
import type { Flight } from '$lib/db/types';
import {
  flightTrackPayloadSchema,
  type FlightTrackInput,
} from '$lib/track/schema';
import { omit } from '$lib/utils/other';
import { listAllFlights, listFlights } from '$lib/server/utils/flight';

type CfValueRow = {
  entityId: string;
  key: string;
  fieldType: string;
  value: unknown;
};

export type BackupScope = 'mine' | 'user' | 'all';
export type BackupFormat = 'json' | 'yaml';

const collectEntityIds = (rows: CfValueRow[]) => {
  const ids = {
    airport: new Set<number>(),
    airline: new Set<number>(),
    aircraft: new Set<number>(),
  };
  for (const row of rows) {
    if (typeof row.value !== 'number') continue;
    if (row.fieldType === 'airport') ids.airport.add(row.value);
    else if (row.fieldType === 'airline') ids.airline.add(row.value);
    else if (row.fieldType === 'aircraft') ids.aircraft.add(row.value);
  }
  return ids;
};

const buildCfByFlight = (
  rows: CfValueRow[],
  entityLookup: Record<string, Map<number, object>>,
) => {
  const cfByFlight = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    let map = cfByFlight.get(row.entityId);
    if (!map) {
      map = Object.create(null) as Record<string, unknown>;
      cfByFlight.set(row.entityId, map);
    }
    const lookup = entityLookup[row.fieldType];
    if (typeof row.value === 'number' && lookup) {
      map[row.key] = lookup.get(row.value) ?? row.value;
    } else {
      map[row.key] = row.value;
    }
  }
  return cfByFlight;
};

const getFlightsForBackup = async (scope: BackupScope, userId?: string) => {
  if (scope === 'all') {
    return await listAllFlights();
  }

  if (!userId) {
    throw new Error('A userId is required for this backup scope');
  }

  return await listFlights(userId);
};

export const generateBackup = async ({
  scope,
  userId,
}: {
  scope: BackupScope;
  userId?: string;
}) => {
  const users = await db
    .selectFrom('user')
    .select(['id', 'displayName', 'username'])
    .execute();
  const res = await getFlightsForBackup(scope, userId);
  const flightIds = res.map((f) => f.id);
  const passengerIds = res.flatMap((flight) =>
    flight.passengers.map((passenger) => passenger.id),
  );
  const trackRows =
    flightIds.length > 0
      ? await db
          .selectFrom('flightTrack')
          .select(['flightId', 'track', 'sourceFormat', 'sourceName'])
          .where('flightId', 'in', flightIds)
          .execute()
      : [];
  const tracksByFlight = new Map<number, FlightTrackInput>(
    trackRows.map((row) => {
      const track = flightTrackPayloadSchema.parse(row.track);
      return [
        row.flightId,
        {
          ...track,
          sourceFormat: row.sourceFormat,
          sourceName: row.sourceName,
        },
      ];
    }),
  );

  const getCustomFieldValues = async (
    entityType: 'flight' | 'flight_passenger',
    entityIds: number[],
  ): Promise<CfValueRow[]> =>
    entityIds.length > 0
      ? await db
          .selectFrom('customFieldValue as v')
          .innerJoin('customFieldDefinition as d', 'd.id', 'v.fieldId')
          .select(['v.entityId', 'd.key', 'd.fieldType', 'v.value'])
          .where('v.entityType', '=', entityType)
          .where('v.entityId', 'in', entityIds.map(String))
          .execute()
      : [];

  const [flightCfValueRows, passengerCfValueRows] = await Promise.all([
    getCustomFieldValues('flight', flightIds),
    getCustomFieldValues('flight_passenger', passengerIds),
  ]);

  const entityIds = collectEntityIds([
    ...flightCfValueRows,
    ...passengerCfValueRows,
  ]);

  const fetchEntity = (
    table: 'airport' | 'airline' | 'aircraft',
    ids: Set<number>,
  ) =>
    ids.size > 0
      ? db
          .selectFrom(table)
          .selectAll()
          .where('id', 'in', [...ids])
          .execute()
      : Promise.resolve([]);

  const [cfAirports, cfAirlines, cfAircrafts] = await Promise.all([
    fetchEntity('airport', entityIds.airport),
    fetchEntity('airline', entityIds.airline),
    fetchEntity('aircraft', entityIds.aircraft),
  ]);
  const entityLookup = {
    airport: new Map(cfAirports.map((a) => [a.id, omit(a, ['id'])])),
    airline: new Map(cfAirlines.map((a) => [a.id, omit(a, ['id'])])),
    aircraft: new Map(cfAircrafts.map((a) => [a.id, omit(a, ['id'])])),
  } as Record<string, Map<number, object>>;

  const cfByFlight = buildCfByFlight(flightCfValueRows, entityLookup);
  const cfByPassenger = buildCfByFlight(passengerCfValueRows, entityLookup);

  const flights = res.map((flight: Flight) => ({
    ...omit(flight, ['id', 'fromId', 'toId', 'airlineId', 'aircraftId']),
    from: flight.from ? omit(flight.from, ['id']) : null,
    to: flight.to ? omit(flight.to, ['id']) : null,
    airline: flight.airline ? omit(flight.airline, ['id']) : null,
    aircraft: flight.aircraft ? omit(flight.aircraft, ['id']) : null,
    passengers: flight.passengers.map((passenger) => ({
      ...omit(passenger, ['id', 'flightId']),
      ...(cfByPassenger.has(String(passenger.id))
        ? { customFields: cfByPassenger.get(String(passenger.id)) }
        : {}),
    })),
    ...(tracksByFlight.has(flight.id)
      ? { track: tracksByFlight.get(flight.id) }
      : {}),
    ...(cfByFlight.has(String(flight.id))
      ? { customFields: cfByFlight.get(String(flight.id)) }
      : {}),
  }));

  return { users, flights };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const yamlKey = (key: string) =>
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);

const yamlScalar = (value: unknown) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(String(value));
};

const isScalar = (value: unknown) =>
  value === null ||
  value === undefined ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

export const stringifyYaml = (value: unknown, indent = 0): string => {
  const prefix = ' '.repeat(indent);

  if (isScalar(value)) {
    return `${prefix}${yamlScalar(value)}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix}[]`;
    return value
      .map((item) => {
        if (isScalar(item)) return `${prefix}- ${yamlScalar(item)}`;
        return `${prefix}-\n${stringifyYaml(item, indent + 2)}`;
      })
      .join('\n');
  }

  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${prefix}{}`;
    return entries
      .map(([key, item]) => {
        if (isScalar(item)) {
          return `${prefix}${yamlKey(key)}: ${yamlScalar(item)}`;
        }
        return `${prefix}${yamlKey(key)}:\n${stringifyYaml(item, indent + 2)}`;
      })
      .join('\n');
  }

  return `${prefix}${yamlScalar(value)}`;
};

export const serializeBackup = (backup: unknown, format: BackupFormat) => {
  if (format === 'yaml') {
    return `${stringifyYaml(backup)}\n`;
  }
  return `${JSON.stringify(backup, null, 2)}\n`;
};
