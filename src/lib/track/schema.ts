import { z } from 'zod';

export const flightTrackSourceFormats = ['gpx', 'kml', 'csv'] as const;
export const MAX_FLIGHT_TRACK_POINTS = 2_000;

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

const flightTrackAlignedPropertySchemas = {
  times: z.number().int().array().max(MAX_FLIGHT_TRACK_POINTS).optional(),
  groundSpeedKt: z.number().array().max(MAX_FLIGHT_TRACK_POINTS).optional(),
  trackDeg: z.number().array().max(MAX_FLIGHT_TRACK_POINTS).optional(),
  ground: z.boolean().array().max(MAX_FLIGHT_TRACK_POINTS).optional(),
  estimated: z.boolean().array().max(MAX_FLIGHT_TRACK_POINTS).optional(),
};

export type FlightTrackAlignedPropertyKey =
  keyof typeof flightTrackAlignedPropertySchemas;

export const flightTrackAlignedPropertyKeys = Object.keys(
  flightTrackAlignedPropertySchemas,
) as FlightTrackAlignedPropertyKey[];

const flightTrackPayloadBaseSchema = z.object({
  coordinates: flightTrackCoordinateSchema
    .array()
    .min(2)
    .max(MAX_FLIGHT_TRACK_POINTS),
  ...flightTrackAlignedPropertySchemas,
});

const hasAlignedTrackProperties = (
  track: z.infer<typeof flightTrackPayloadBaseSchema>,
) => {
  return flightTrackAlignedPropertyKeys.every(
    (key) => !track[key] || track[key].length === track.coordinates.length,
  );
};

export const flightTrackPayloadSchema = flightTrackPayloadBaseSchema.refine(
  hasAlignedTrackProperties,
  'Track properties must align with coordinates',
);

export const flightTrackInputSchema = flightTrackPayloadBaseSchema
  .extend({
    sourceFormat: z.enum(flightTrackSourceFormats),
    sourceName: z.string().max(255).nullable().optional(),
  })
  .refine(
    hasAlignedTrackProperties,
    'Track properties must align with coordinates',
  );

export type FlightTrackSourceFormat = (typeof flightTrackSourceFormats)[number];
export type FlightTrackCoordinate = z.infer<typeof flightTrackCoordinateSchema>;
export type FlightTrackPayload = z.infer<typeof flightTrackPayloadSchema>;
export type FlightTrackInput = z.infer<typeof flightTrackInputSchema>;
export type FlightTrackRow = FlightTrackInput & {
  flightId: number;
  pointCount: number;
};

type FlightTrackPayloadSource = Pick<FlightTrackPayload, 'coordinates'> &
  Partial<Pick<FlightTrackPayload, FlightTrackAlignedPropertyKey>>;

type FlightTrackCopyOptions = {
  includeTimes?: boolean;
};

export const copyFlightTrackAlignedProperties = (
  track: Partial<Pick<FlightTrackPayload, FlightTrackAlignedPropertyKey>>,
  { includeTimes = true }: FlightTrackCopyOptions = {},
) =>
  Object.fromEntries(
    flightTrackAlignedPropertyKeys.flatMap((key) => {
      if (key === 'times' && !includeTimes) return [];
      const value = track[key];
      return value ? [[key, value]] : [];
    }),
  ) as Partial<Pick<FlightTrackPayload, FlightTrackAlignedPropertyKey>>;

export const toFlightTrackPayload = (
  track: FlightTrackPayloadSource,
  options?: FlightTrackCopyOptions,
): FlightTrackPayload => ({
  coordinates: track.coordinates,
  ...copyFlightTrackAlignedProperties(track, options),
});

export const toFlightTrackInput = (
  track: FlightTrackPayloadSource & {
    sourceFormat: FlightTrackSourceFormat;
    sourceName?: string | null;
  },
  options?: FlightTrackCopyOptions,
): FlightTrackInput => ({
  ...toFlightTrackPayload(track, options),
  sourceFormat: track.sourceFormat,
  sourceName: track.sourceName,
});
