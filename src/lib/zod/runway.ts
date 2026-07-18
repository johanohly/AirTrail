import { z } from 'zod';

const numericBoolean = z.preprocess((val) => String(val) === '1', z.boolean());

/**
 * Numeric columns are blank (`""`) when unknown. `z.coerce.number()` would turn
 * that into `0`, so map empty values to `null` before coercing.
 */
const nullableNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.number().nullable(),
);

const nullableString = z.preprocess(
  (val) => (val === '' || val === undefined ? null : val),
  z.string().nullable(),
);

export const runwaySourceSchema = z.object({
  id: z.coerce.number(),
  airport_ref: z.coerce.number(),
  airport_ident: z.string(), // used to match back to the airport
  length_ft: nullableNumber,
  width_ft: nullableNumber,
  surface: nullableString,
  lighted: numericBoolean,
  closed: numericBoolean,
  le_ident: nullableString,
  le_latitude_deg: nullableNumber,
  le_longitude_deg: nullableNumber,
  le_elevation_ft: nullableNumber,
  le_heading_degT: nullableNumber,
  le_displaced_threshold_ft: nullableNumber,
  he_ident: nullableString,
  he_latitude_deg: nullableNumber,
  he_longitude_deg: nullableNumber,
  he_elevation_ft: nullableNumber,
  he_heading_degT: nullableNumber,
  he_displaced_threshold_ft: nullableNumber,
});

export type RunwaySourceRow = z.infer<typeof runwaySourceSchema>;
