import { z } from 'zod';

import { AirportTypes, Continents } from '$lib/db/types';

export const airportSchema = z.object({
  id: z.number().nullable(),
  icao: z
    .string({ message: 'Set a code' })
    .regex(/^[A-Z]{4}$/, 'Code must be 4 uppercase letters'),
  type: z
    .enum(AirportTypes, { message: 'Select an airport type' })
    // @ts-expect-error - Superforms needs an empty initial value that validation rejects
    .prefault(''),
  name: z.string().min(1, 'Set a name'),
  municipality: z.string(),
  // @ts-expect-error - Superforms needs an empty initial value that validation rejects
  lat: z.number({ message: 'Set the latitude' }).prefault(null),
  // @ts-expect-error - Superforms needs an empty initial value that validation rejects
  lon: z.number({ message: 'Set the longitude' }).prefault(null),
  continent: z
    .enum(Continents, { message: 'Select a continent' })
    // @ts-expect-error - Superforms needs an empty initial value that validation rejects
    .prefault(''),
  country: z.string().min(1, 'Select a country'),
  iata: z.string(),
  tz: z
    .string({ message: 'Select a timezone' })
    .regex(/^[a-zA-Z]+\/[a-zA-Z_]+$/, 'Must be a valid timezone ID'),
});

export const airportFormDefaults = {
  id: null,
  icao: '',
  type: '',
  name: '',
  municipality: '',
  lat: null,
  lon: null,
  continent: '',
  country: '',
  iata: '',
  tz: '',
} as unknown as z.infer<typeof airportSchema>;

/*
 * Only used inside the flight schema.
 */
export const flightAirportSchema = z.object({
  id: z.number(),
  type: z.enum(AirportTypes),
  name: z.string(),
  municipality: z.string().nullable().default(null),
  lat: z.number(),
  lon: z.number(),
  continent: z.enum(Continents),
  country: z.string(),
  icao: z.string(),
  iata: z.string().nullable(),
  tz: z.string(),
  custom: z.boolean(),
});

const yesNoBoolean = z.preprocess((val) => String(val) === 'yes', z.boolean());
export const airportSourceSchema = z.object({
  id: z.coerce.number(),
  ident: z.string(),
  type: z.enum(AirportTypes),
  name: z.string(),
  latitude_deg: z.coerce.number(),
  longitude_deg: z.coerce.number(),
  elevation_ft: z.coerce.number().nullable(),
  continent: z.enum(Continents),
  iso_country: z.string(),
  iso_region: z.string(),
  municipality: z.string().nullable(),
  scheduled_service: yesNoBoolean,
  gps_code: z.string().nullable(),
  iata_code: z.string(),
  local_code: z.string().nullable(),
  home_link: z.string().nullable(),
  wikipedia_link: z.string().nullable(),
  keywords: z.string().nullable(),
});
