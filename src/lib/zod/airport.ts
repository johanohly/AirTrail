import { z } from 'zod';
import { AirportTypes, Continents } from '$lib/db/types';

const yesNoBoolean = z.preprocess((val) => String(val) === 'yes', z.boolean());
export const airportSchema = z.object({
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
  iata_code: z.string().nullable(),
  local_code: z.string().nullable(),
  home_link: z.string().nullable(),
  wikipedia_link: z.string().nullable(),
  keywords: z.string().nullable(),
});
