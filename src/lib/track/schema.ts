import { z } from 'zod';

export const flightTrackSourceFormats = ['gpx', 'kml', 'csv'] as const;
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

const flightTrackPayloadBaseSchema = z.object({
  coordinates: flightTrackCoordinateSchema
    .array()
    .min(2)
    .max(MAX_STORED_FLIGHT_TRACK_POINTS),
  ...flightTrackAlignedPropertySchemas,
});

const hasAlignedTrackProperties = (
  track: z.infer<typeof flightTrackPayloadBaseSchema>,
) => {
  return (
    (!track.times || track.times.length === track.coordinates.length) &&
    (!track.groundSpeedKt ||
      track.groundSpeedKt.length === track.coordinates.length) &&
    (!track.trackDeg || track.trackDeg.length === track.coordinates.length) &&
    (!track.ground || track.ground.length === track.coordinates.length) &&
    (!track.estimated || track.estimated.length === track.coordinates.length)
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

export type FlightTrackAlignedProperties = Pick<
  FlightTrackPayload,
  'times' | 'groundSpeedKt' | 'trackDeg' | 'ground' | 'estimated'
>;

type FlightTrackPayloadSource = Pick<FlightTrackPayload, 'coordinates'> &
  FlightTrackAlignedProperties;

type FlightTrackCopyOptions = {
  includeTimes?: boolean;
};

export const copyFlightTrackAlignedProperties = (
  track: FlightTrackAlignedProperties,
  { includeTimes = true }: FlightTrackCopyOptions = {},
): FlightTrackAlignedProperties => ({
  ...(includeTimes && track.times ? { times: track.times } : {}),
  ...(track.groundSpeedKt ? { groundSpeedKt: track.groundSpeedKt } : {}),
  ...(track.trackDeg ? { trackDeg: track.trackDeg } : {}),
  ...(track.ground ? { ground: track.ground } : {}),
  ...(track.estimated ? { estimated: track.estimated } : {}),
});

export const pickFlightTrackPoints = (
  track: FlightTrackPayload,
  indices: number[],
): FlightTrackPayload => ({
  coordinates: indices.map((index) => track.coordinates[index]!),
  ...(track.times
    ? { times: indices.map((index) => track.times![index]!) }
    : {}),
  ...(track.groundSpeedKt
    ? {
        groundSpeedKt: indices.map((index) => track.groundSpeedKt![index]!),
      }
    : {}),
  ...(track.trackDeg
    ? { trackDeg: indices.map((index) => track.trackDeg![index]!) }
    : {}),
  ...(track.ground
    ? { ground: indices.map((index) => track.ground![index]!) }
    : {}),
  ...(track.estimated
    ? { estimated: indices.map((index) => track.estimated![index]!) }
    : {}),
});

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
