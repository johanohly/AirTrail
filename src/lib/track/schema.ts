import { z } from 'zod';

export const flightTrackSourceFormats = [
  'gpx',
  'kml',
  'csv',
  'readsb',
] as const;
export const MAX_STORED_FLIGHT_TRACK_POINTS = 100_000;
export const MAX_RENDERED_FLIGHT_TRACK_POINTS = 5_000;

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
  times: z
    .number()
    .int()
    .array()
    .max(MAX_STORED_FLIGHT_TRACK_POINTS)
    .optional(),
  groundSpeedKt: z
    .number()
    .array()
    .max(MAX_STORED_FLIGHT_TRACK_POINTS)
    .optional(),
  trackDeg: z.number().array().max(MAX_STORED_FLIGHT_TRACK_POINTS).optional(),
  ground: z.boolean().array().max(MAX_STORED_FLIGHT_TRACK_POINTS).optional(),
  estimated: z.boolean().array().max(MAX_STORED_FLIGHT_TRACK_POINTS).optional(),
};
type FlightTrackAlignedPropertyKey =
  keyof typeof flightTrackAlignedPropertySchemas;
const flightTrackAlignedPropertyKeys = Object.keys(
  flightTrackAlignedPropertySchemas,
) as FlightTrackAlignedPropertyKey[];

const flightTrackPayloadBaseSchema = z.object({
  coordinates: flightTrackCoordinateSchema
    .array()
    .min(2)
    .max(MAX_STORED_FLIGHT_TRACK_POINTS),
  ...flightTrackAlignedPropertySchemas,
});

const hasAlignedTrackProperties = (
  track: z.infer<typeof flightTrackPayloadBaseSchema>,
) =>
  flightTrackAlignedPropertyKeys.every((key) => {
    const values = track[key];
    return values === undefined || values.length === track.coordinates.length;
  });

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

export type FlightTrackAlignedProperties = Pick<
  FlightTrackPayload,
  FlightTrackAlignedPropertyKey
>;

type FlightTrackPayloadSource = Pick<FlightTrackPayload, 'coordinates'> &
  FlightTrackAlignedProperties;

type FlightTrackCopyOptions = {
  includeTimes?: boolean;
};

export const copyFlightTrackAlignedProperties = (
  track: FlightTrackAlignedProperties,
  { includeTimes = true }: FlightTrackCopyOptions = {},
): FlightTrackAlignedProperties => {
  const properties: FlightTrackAlignedProperties = {};

  for (const key of flightTrackAlignedPropertyKeys) {
    if (key === 'times' && !includeTimes) continue;
    const values = track[key];
    if (values !== undefined) Object.assign(properties, { [key]: values });
  }

  return properties;
};

export const pickFlightTrackPoints = (
  track: FlightTrackPayload,
  indices: number[],
): FlightTrackPayload => {
  const properties: FlightTrackAlignedProperties = {};

  for (const key of flightTrackAlignedPropertyKeys) {
    const values = track[key];
    if (values === undefined) continue;
    Object.assign(properties, {
      [key]: indices.map((index) => values[index]!),
    });
  }

  return {
    coordinates: indices.map((index) => track.coordinates[index]!),
    ...properties,
  };
};

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
