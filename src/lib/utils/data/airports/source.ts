import { find } from 'geo-tz';

import { db } from '$lib/db';
import type { Airport } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { deepEqual } from '$lib/utils/other';
import { airportSourceSchema } from '$lib/zod/airport';

export const BATCH_SIZE = 1000;

export const ensureAirports = async () => {
  const airports = await db.selectFrom('airport').execute();
  if (airports.length > 0) {
    return;
  }

  console.time('Populate initial airport database');

  const data = await fetchAirports();
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await db
      .insertInto('airport')
      .values(data.slice(i, i + BATCH_SIZE))
      .execute();
  }

  console.timeEnd('Populate initial airport database');
};

export const updateAirports = async () => {
  const start = Date.now();

  const existingAirports = await db.selectFrom('airport').selectAll().execute();
  const existingMap = new Map(existingAirports.map((a) => [a.id, a]));
  const data = await fetchAirports();
  const newMap = new Map(data.map((a) => [a.id, a]));

  const newAirports: Airport[] = [];
  const updatedAirports: Airport[] = [];
  const removedAirports: Airport[] = [];

  for (const airport of data) {
    const existing = existingMap.get(airport.id);

    // Means the airport was manually added by the user
    if (existing?.custom) {
      continue;
    }

    if (!existing) {
      newAirports.push(airport);
    } else if (!deepEqual(airport, existing)) {
      updatedAirports.push(airport);
    }
  }

  for (const airport of existingAirports) {
    if (!newMap.has(airport.id) && !airport.custom) {
      removedAirports.push(airport);
    }
  }

  for (let i = 0; i < newAirports.length; i += BATCH_SIZE) {
    await db
      .insertInto('airport')
      .values(newAirports.slice(i, i + BATCH_SIZE))
      .execute();
  }

  for (const airport of updatedAirports) {
    await db
      .updateTable('airport')
      .set(airport)
      .where('id', '=', airport.id)
      .execute();
  }

  for (let i = 0; i < removedAirports.length; i += BATCH_SIZE) {
    await db
      .deleteFrom('airport')
      .where(
        'id',
        'in',
        removedAirports.slice(i, i + BATCH_SIZE).map((a) => a.id),
      )
      .execute();
  }

  return {
    created: newAirports.length,
    updated: updatedAirports.length,
    removed: removedAirports.length,
    time: Date.now() - start,
  };
};

export const fetchAirports = async (): Promise<Airport[]> => {
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

  const airports: Airport[] = data
    .map((airport) => {
      const tz = find(airport.latitude_deg, airport.longitude_deg)[0];
      if (!tz) {
        console.error(
          `Could not find timezone for ${airport.latitude_deg}, ${airport.longitude_deg}`,
        );
        return null; // Exclude invalid entries
      }

      return {
        icao: createAirportCode(airport, dataMap),
        iata: airport.iata_code === '' ? null : airport.iata_code,
        type: airport.type,
        name: airport.name,
        lat: airport.latitude_deg,
        lon: airport.longitude_deg,
        continent: airport.continent,
        country: airport.iso_country,
        tz,
        custom: false,
      };
    })
    .filter((airport) => airport !== null) as Airport[];

  return airports;
};
