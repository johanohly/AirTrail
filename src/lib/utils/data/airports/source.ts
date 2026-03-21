import { find } from 'geo-tz';
import { sql } from 'kysely';

import { db } from '$lib/db';
import type { Airport } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { deepEqual } from '$lib/utils/other';
import { airportSourceSchema } from '$lib/zod/airport';

export const BATCH_SIZE = 1000;

/**
 * Manual timezone overrides for airports where geo-tz returns incorrect results.
 * Key: ICAO code, Value: Correct IANA timezone
 *
 * OOL (Gold Coast): Located right on the Queensland/NSW border.
 * geo-tz returns Australia/Sydney (NSW, has DST) but it should be
 * Australia/Brisbane (Queensland, no DST) as the airport operates on QLD time.
 */
const TIMEZONE_OVERRIDES: Record<string, string> = {
  YBCG: 'Australia/Brisbane', // Gold Coast (OOL)
};

export const ensureAirports = async () => {
  const airports = await db
    .selectFrom('airport')
    .where('custom', '=', false)
    .execute();

  if (airports.length === 0) {
    // No airports at all - do initial population
    console.log('Populating initial airport database...');
    console.time('Populate initial airport database');

    const data = await fetchAirports();

    // Check for existing (custom) airports to avoid duplicates
    const existingAirports = await db
      .selectFrom('airport')
      .selectAll()
      .execute();
    const existingMap = new Map(existingAirports.map((a) => [a.icao, a]));

    const newAirports = data.filter((airport) => {
      const existing = existingMap.get(airport.icao);
      return !existing;
    });

    for (let i = 0; i < newAirports.length; i += BATCH_SIZE) {
      await db
        .insertInto('airport')
        .values(newAirports.slice(i, i + BATCH_SIZE))
        .execute();
    }

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
  const data = await fetchAirports();
  const newMap = new Map(data.map((a) => [a.icao, a]));

  const newAirports: InsertAirport[] = [];
  const updatedAirports: Airport[] = [];
  const removedAirports: Airport[] = [];

  for (const airport of data) {
    const existing = existingMap.get(airport.icao);

    // Means the airport was manually added by the user
    if (existing?.custom) {
      continue;
    }

    if (!existing) {
      newAirports.push(airport);
    } else {
      const { id: _, ...airportWithoutId } = existing;
      if (!deepEqual(airport, airportWithoutId)) {
        updatedAirports.push({ ...airport, id: existing.id });
      }
    }
  }

  for (const airport of existingAirports) {
    if (!newMap.has(airport.icao) && !airport.custom) {
      removedAirports.push(airport);
    }
  }

  for (let i = 0; i < newAirports.length; i += BATCH_SIZE) {
    await db
      .insertInto('airport')
      .values(newAirports.slice(i, i + BATCH_SIZE))
      .execute();
  }

  for (let i = 0; i < updatedAirports.length; i += BATCH_SIZE) {
    const batch = updatedAirports.slice(i, i + BATCH_SIZE);
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
        batch.map(
          (a) =>
            sql`(${a.id}::int, ${a.icao}, ${a.iata}, ${a.lat}::float8, ${a.lon}::float8, ${a.tz}, ${a.name}, ${a.municipality}, ${a.type}, ${a.continent}, ${a.country}, ${a.custom}::bool)`,
        ),
      )}) AS v(id, icao, iata, lat, lon, tz, name, municipality, type, continent, country, custom)
      WHERE airport.id = v.id
    `.execute(db);
  }

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
    created: newAirports.length,
    updated: updatedAirports.length,
    removed: safeToRemove.length,
    retained: removedAirports.length - safeToRemove.length,
    time: Date.now() - start,
  };
};

export const fetchAirports = async (): Promise<InsertAirport[]> => {
  const resp = await fetch(
    'https://davidmegginson.github.io/ourairports-data/airports.csv',
  );
  const text = await resp.text();
  const [data, error] = parseCsv(text, airportSourceSchema);
  if (error) {
    return [];
  }

  const createAirportCode = (
    airport: (typeof data)[0],
    dataMap: Map<string, number>,
  ): string => {
    const gpsCode = airport.gps_code?.toUpperCase();
    const ident = airport.ident.toUpperCase();

    return gpsCode &&
      gpsCode.length === 4 &&
      (!dataMap.has(gpsCode) || dataMap.get(gpsCode) === airport.id)
      ? gpsCode
      : ident;
  };

  const dataMap = new Map<string, number>();
  for (const airport of data) {
    const key = airport.ident.toUpperCase();
    dataMap.set(key, airport.id);
  }

  const airports: InsertAirport[] = [];
  const keywordsByIndex: (string | null)[] = [];

  for (const airport of data) {
    const icao = createAirportCode(airport, dataMap);
    const tz =
      TIMEZONE_OVERRIDES[icao] ??
      find(airport.latitude_deg, airport.longitude_deg)[0];
    if (!tz) {
      console.error(
        `Could not find timezone for ${airport.latitude_deg}, ${airport.longitude_deg}`,
      );
      continue;
    }

    airports.push({
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
    });
    keywordsByIndex.push(airport.keywords);
  }

  fillCodesFromKeywords(airports, keywordsByIndex);

  return airports;
};

/**
 * For airports missing an ICAO or IATA code, attempt to extract one from the
 * OurAirports `keywords` field. Keywords often contain historical codes for
 * closed airports (e.g. "TXL, EDDT" for Berlin-Tegel).
 *
 * Only extracts from keywords matching the pattern "IATA, ICAO, ..."
 * (3-letter code followed by 4-letter code as the first two tokens).
 *
 * A keyword code is only used if no other airport in the list already has it.
 */
const fillCodesFromKeywords = (
  airports: InsertAirport[],
  keywordsByIndex: (string | null)[],
) => {
  const ICAO_RE = /^[A-Z]{4}$/;
  const IATA_RE = /^[A-Z]{3}$/;

  const usedIcao = new Set(airports.map((a) => a.icao));
  const usedIata = new Set(airports.filter((a) => a.iata).map((a) => a.iata!));

  for (let i = 0; i < airports.length; i++) {
    const airport = airports[i]!;
    const keywords = keywordsByIndex[i];
    if (!keywords) continue;

    const hasProperIcao = ICAO_RE.test(airport.icao);
    const hasIata = airport.iata !== null;

    if (hasProperIcao && hasIata) continue;

    const tokens = keywords.split(',').map((t) => t.trim());
    if (tokens.length < 2) continue;

    const [iataToken, icaoToken] = tokens;
    if (!iataToken || !icaoToken) continue;
    if (!IATA_RE.test(iataToken) || !ICAO_RE.test(icaoToken)) continue;

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

type InsertAirport = Omit<Airport, 'id'>;
