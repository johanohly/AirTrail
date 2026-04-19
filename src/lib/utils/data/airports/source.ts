import { sql } from 'kysely';
import { z } from 'zod';

import { db } from '$lib/db';
import type { Airport } from '$lib/db/types';
import { forEachCsvRow } from '$lib/utils/csv-stream';
import { deepEqual } from '$lib/utils/other';
import { airportSourceSchema } from '$lib/zod/airport';

import { getAirportTimezone, withBoundedGeoTzCache } from './timezone';

export const BATCH_SIZE = 1000;
const AIRPORT_SOURCE_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv';
const ICAO_RE = /^[A-Z]{4}$/;
const IATA_RE = /^[A-Z]{3}$/;

export const ensureAirports = async () => {
  const airports = await db
    .selectFrom('airport')
    .where('custom', '=', false)
    .execute();

  if (airports.length === 0) {
    // No airports at all - do initial population
    console.log('Populating initial airport database...');
    console.time('Populate initial airport database');

    // Check for existing (custom) airports to avoid duplicates
    const existingAirports = await db
      .selectFrom('airport')
      .select('icao')
      .execute();
    const existingIcaos = new Set(existingAirports.map((a) => a.icao));
    const batch: InsertAirport[] = [];

    await forEachFetchedAirport(async (airport) => {
      if (existingIcaos.has(airport.icao)) {
        return;
      }

      batch.push(airport);
      if (batch.length >= BATCH_SIZE) {
        await insertAirportBatch(batch);
      }
    });

    await insertAirportBatch(batch);

    console.timeEnd('Populate initial airport database');
    return;
  }

  // Check if any non-custom airport has a municipality (migration check)
  const anyWithMunicipality = await db
    .selectFrom('airport')
    .select('id')
    .where('custom', '=', false)
    .where('municipality', 'is not', null)
    .limit(1)
    .executeTakeFirst();

  if (!anyWithMunicipality) {
    // Need to re-import to populate municipality
    console.log('Re-importing airports to populate municipality...');
    console.time('Re-importing airports to populate municipality');
    await updateAirports();
    console.timeEnd('Re-importing airports to populate municipality');
  }
};

export const updateAirports = async () => {
  const start = Date.now();

  const existingAirports = await db.selectFrom('airport').selectAll().execute();
  const existingMap = new Map(existingAirports.map((a) => [a.icao, a]));
  const seenIcaos = new Set<string>();
  const newAirports: InsertAirport[] = [];
  const updatedAirports: Airport[] = [];
  let created = 0;
  let updated = 0;

  await forEachFetchedAirport(async (airport) => {
    seenIcaos.add(airport.icao);

    const existing = existingMap.get(airport.icao);

    // Means the airport was manually added by the user
    if (existing?.custom) {
      return;
    }

    if (!existing) {
      newAirports.push(airport);
      created += 1;
      if (newAirports.length >= BATCH_SIZE) {
        await insertAirportBatch(newAirports);
      }
      return;
    }

    const { id: _, ...airportWithoutId } = existing;
    if (!deepEqual(airport, airportWithoutId)) {
      updatedAirports.push({ ...airport, id: existing.id });
      updated += 1;
      if (updatedAirports.length >= BATCH_SIZE) {
        await updateAirportBatch(updatedAirports);
      }
    }
  });

  await insertAirportBatch(newAirports);
  await updateAirportBatch(updatedAirports);

  const removedAirports = existingAirports.filter(
    (airport) => !airport.custom && !seenIcaos.has(airport.icao),
  );

  // Don't delete airports that are referenced by flights (ON DELETE SET NULL
  // would silently orphan the flight's airport association).
  const removedIds = removedAirports.map((a) => a.id);
  const referencedIds =
    removedAirports.length > 0
      ? new Set(
          (
            await db
              .selectFrom('flight')
              .select('fromId')
              .where('fromId', 'in', removedIds)
              .union(
                db
                  .selectFrom('flight')
                  .select('toId as fromId')
                  .where('toId', 'in', removedIds),
              )
              .execute()
          ).map((r) => r.fromId),
        )
      : new Set<number | null>();

  const safeToRemove = removedAirports.filter((a) => !referencedIds.has(a.id));

  for (let i = 0; i < safeToRemove.length; i += BATCH_SIZE) {
    await db
      .deleteFrom('airport')
      .where(
        'id',
        'in',
        safeToRemove.slice(i, i + BATCH_SIZE).map((a) => a.id),
      )
      .execute();
  }

  return {
    created,
    updated,
    removed: safeToRemove.length,
    retained: removedAirports.length - safeToRemove.length,
    time: Date.now() - start,
  };
};

export const fetchAirports = async (): Promise<InsertAirport[]> => {
  const airports: InsertAirport[] = [];

  await forEachFetchedAirport((airport) => {
    airports.push(airport);
  });

  return airports;
};

const forEachFetchedAirport = async (
  onAirport: (airport: InsertAirport) => Promise<void> | void,
) => {
  await withBoundedGeoTzCache(async () => {
    const identSet = await collectAirportSourceIdentSet();

    const usedIcao = new Set<string>();
    const usedIata = new Set<string>();
    const pendingKeywordFill: Array<{
      airport: InsertAirport;
      keywords: string | null;
    }> = [];

    await forEachAirportSourceRow(async (sourceAirport) => {
      const airport = toInsertAirport(sourceAirport, identSet);
      if (!airport) {
        return;
      }

      usedIcao.add(airport.icao);
      if (airport.iata) {
        usedIata.add(airport.iata);
      }

      if (needsKeywordFill(airport, sourceAirport.keywords)) {
        pendingKeywordFill.push({
          airport,
          keywords: sourceAirport.keywords,
        });

        return;
      }

      await onAirport(airport);
    });

    fillPendingKeywordCodes(pendingKeywordFill, usedIcao, usedIata);

    for (const { airport } of pendingKeywordFill) {
      await onAirport(airport);
    }
  });
};

const collectAirportSourceIdentSet = async () => {
  const identSet = new Set<string>();

  await forEachAirportSourceRow((airport) => {
    identSet.add(airport.ident.toUpperCase());
  });

  return identSet;
};

const forEachAirportSourceRow = async (
  onRow: (row: AirportSourceRow) => Promise<void> | void,
) => {
  const resp = await fetch(AIRPORT_SOURCE_URL);
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch airport source CSV: ${resp.status} ${resp.statusText}`,
    );
  }
  if (!resp.body) {
    throw new Error('Airport source CSV response did not include a body');
  }

  await forEachCsvRow(resp.body, airportSourceSchema, onRow, (row, error) => {
    console.error('Error parsing airport row:', row, error);
  });
};

const toInsertAirport = (
  airport: AirportSourceRow,
  identSet: Set<string>,
): InsertAirport | null => {
  const icao = createAirportCode(airport, identSet);
  const tz = getAirportTimezone(
    icao,
    airport.latitude_deg,
    airport.longitude_deg,
  );
  if (!tz) {
    console.error(
      `Could not find timezone for ${airport.latitude_deg}, ${airport.longitude_deg}`,
    );
    return null;
  }

  return {
    icao,
    iata: airport.iata_code === '' ? null : airport.iata_code,
    type: airport.type,
    name: airport.name,
    municipality: airport.municipality || null,
    lat: airport.latitude_deg,
    lon: airport.longitude_deg,
    continent: airport.continent,
    country: airport.iso_country,
    tz,
    custom: false,
  };
};

const createAirportCode = (
  airport: AirportSourceRow,
  identSet: Set<string>,
): string => {
  const gpsCode = airport.gps_code?.toUpperCase();
  const ident = airport.ident.toUpperCase();

  return gpsCode &&
    gpsCode.length === 4 &&
    (!identSet.has(gpsCode) || gpsCode === ident)
    ? gpsCode
    : ident;
};

const needsKeywordFill = (airport: InsertAirport, keywords: string | null) => {
  if (ICAO_RE.test(airport.icao) && airport.iata !== null) {
    return false;
  }

  return getKeywordCodeCandidate(keywords) !== null;
};

const getKeywordCodeCandidate = (keywords: string | null) => {
  if (!keywords) {
    return null;
  }

  const tokens = keywords.split(',').map((t) => t.trim());
  if (tokens.length < 2) {
    return null;
  }

  const [iataToken, icaoToken] = tokens;
  if (!iataToken || !icaoToken) {
    return null;
  }
  if (!IATA_RE.test(iataToken) || !ICAO_RE.test(icaoToken)) {
    return null;
  }

  return { iataToken, icaoToken };
};

/**
 * Apply keyword-based backfills after the full source has been scanned so
 * we do not claim a code that is already used by a later airport row.
 */
const fillPendingKeywordCodes = (
  airports: Array<{ airport: InsertAirport; keywords: string | null }>,
  usedIcao: Set<string>,
  usedIata: Set<string>,
) => {
  for (const { airport, keywords } of airports) {
    const candidate = getKeywordCodeCandidate(keywords);
    if (!candidate) continue;

    const hasProperIcao = ICAO_RE.test(airport.icao);
    const hasIata = airport.iata !== null;

    if (hasProperIcao && hasIata) continue;

    const { iataToken, icaoToken } = candidate;

    if (!hasProperIcao && !usedIcao.has(icaoToken)) {
      usedIcao.add(icaoToken);
      airport.icao = icaoToken;
    }

    if (!hasIata && !usedIata.has(iataToken)) {
      usedIata.add(iataToken);
      airport.iata = iataToken;
    }
  }
};

const insertAirportBatch = async (airports: InsertAirport[]) => {
  if (airports.length === 0) {
    return;
  }

  await db.insertInto('airport').values(airports).execute();
  airports.length = 0;
};

const updateAirportBatch = async (airports: Airport[]) => {
  if (airports.length === 0) {
    return;
  }

  await sql`
    UPDATE airport SET
      icao = v.icao,
      iata = v.iata,
      lat = v.lat,
      lon = v.lon,
      tz = v.tz,
      name = v.name,
      municipality = v.municipality,
      type = v.type,
      continent = v.continent,
      country = v.country,
      custom = v.custom
    FROM (VALUES ${sql.join(
      airports.map(
        (a) =>
          sql`(${a.id}::int, ${a.icao}, ${a.iata}, ${a.lat}::float8, ${a.lon}::float8, ${a.tz}, ${a.name}, ${a.municipality}, ${a.type}, ${a.continent}, ${a.country}, ${a.custom}::bool)`,
      ),
    )}) AS v(id, icao, iata, lat, lon, tz, name, municipality, type, continent, country, custom)
    WHERE airport.id = v.id
  `.execute(db);

  airports.length = 0;
};

type AirportSourceRow = z.infer<typeof airportSourceSchema>;

type InsertAirport = Omit<Airport, 'id'>;
