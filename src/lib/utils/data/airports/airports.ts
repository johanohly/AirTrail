import { find } from 'geo-tz';

import { db } from '$lib/db';
import { AirportTypes, Continents } from '$lib/db/types';
import { parseCsv } from '$lib/utils';
import { airportSchema } from '$lib/zod/airport';

export type Airport = {
  code: string;
  type: (typeof AirportTypes)[number];
  name: string;
  lat: number;
  lon: number;
  continent: (typeof Continents)[number];
  country: string;
  iata: string | null;
  tz: string;
};

export const ensureAirports = async () => {
  const airports = await db.selectFrom('airport').execute();
  if (airports.length > 0) {
    return;
  }

  console.time('Populate initial airport database');

  const data = await fetchAirports();
  for (let i = 0; i < data.length; i += 1000) {
    await db
      .insertInto('airport')
      .values(data.slice(i, i + 1000))
      .execute();
  }

  console.timeEnd('Populate initial airport database');
};

export const fetchAirports = async () => {
  const resp = await fetch(
    'https://davidmegginson.github.io/ourairports-data/airports.csv',
  );
  const text = await resp.text();
  const [data, error] = parseCsv(text, airportSchema);
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
        code: createAirportCode(airport, dataMap),
        iata: airport.iata_code,
        type: airport.type,
        name: airport.name,
        lat: airport.latitude_deg,
        lon: airport.longitude_deg,
        continent: airport.continent,
        country: airport.iso_country,
        tz,
      };
    })
    .filter((airport) => airport !== null) as Airport[];

  return airports;
};
