import { z } from 'zod';

export const flightTrackSourceFormats = ['gpx', 'kml', 'csv'] as const;

export const flightTrackCoordinateSchema = z
  .union([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ])
  .refine(
    ([lon, lat, alt]) =>
      Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      (alt === undefined || Number.isFinite(alt)),
    'Invalid track coordinate',
  );

const flightTrackPayloadBaseSchema = z.object({
  coordinates: flightTrackCoordinateSchema.array().min(2),
  times: z.number().int().array().optional(),
});

export const flightTrackPayloadSchema = flightTrackPayloadBaseSchema.refine(
  (track) => !track.times || track.times.length === track.coordinates.length,
  'Track times must align with coordinates',
);

export const flightTrackInputSchema = flightTrackPayloadBaseSchema
  .extend({
    sourceFormat: z.enum(flightTrackSourceFormats),
    sourceName: z.string().max(255).nullable().optional(),
  })
  .refine(
    (track) => !track.times || track.times.length === track.coordinates.length,
    'Track times must align with coordinates',
  );

export type FlightTrackSourceFormat = (typeof flightTrackSourceFormats)[number];
export type FlightTrackCoordinate = z.infer<typeof flightTrackCoordinateSchema>;
export type FlightTrackPayload = z.infer<typeof flightTrackPayloadSchema>;
export type FlightTrackInput = z.infer<typeof flightTrackInputSchema>;
export type FlightTrackRow = FlightTrackInput & {
  flightId: number;
  pointCount: number;
};
