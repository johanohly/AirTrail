import { z } from 'zod';

export const flightCategorySchema = z.enum(['VFR', 'MVFR', 'IFR', 'LIFR']);
export type FlightCategory = z.infer<typeof flightCategorySchema>;

export const cloudCoverageSchema = z.enum([
  'SKC',
  'FEW',
  'SCT',
  'BKN',
  'OVC',
]);
export type CloudCoverage = z.infer<typeof cloudCoverageSchema>;

export const cloudLayerSchema = z.object({
  coverage: cloudCoverageSchema,
  baseFt: z.number(),
  modifier: z.enum(['CB', 'TCU']).nullable().optional(),
});
export type CloudLayer = z.infer<typeof cloudLayerSchema>;

export const metarWindSchema = z.object({
  dirDeg: z.number().nullable(),
  speedKt: z.number(),
  gustKt: z.number().nullable(),
  varies: z
    .object({ from: z.number(), to: z.number() })
    .nullable()
    .optional(),
});

export const parsedMetarSchema = z.object({
  raw: z.string(),
  station: z.string(),
  observedAtIso: z.string(),
  wind: metarWindSchema,
  visibilityM: z.number(),
  cavok: z.boolean(),
  clouds: z.array(cloudLayerSchema),
  verticalVisibilityFt: z.number().nullable(),
  tempC: z.number().nullable(),
  dewpointC: z.number().nullable(),
  pressureHpa: z.number().nullable(),
  flightCategory: flightCategorySchema,
});
export type ParsedMetar = z.infer<typeof parsedMetarSchema>;
