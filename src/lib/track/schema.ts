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
      lon >= -180 &&
      lon <= 180 &&
      Number.isFinite(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      (alt === undefined || Number.isFinite(alt)),
    'Invalid track coordinate',
  );

export type FlightTrackSample = {
  coordinate: FlightTrackCoordinate;
  point: {
    time?: number;
    groundSpeedKt?: number;
    trackDeg?: number;
    ground?: boolean;
  };
  incomingEdge: {
    estimated?: boolean;
  };
};

const alignedProperty = <T>(
  schema: z.ZodType<T>,
  get: (sample: FlightTrackSample) => T | undefined,
  set: (sample: FlightTrackSample, value: T) => void,
) => ({
  schema,
  get,
  set: (sample: FlightTrackSample, value: unknown) => set(sample, value as T),
});

const flightTrackAlignedPropertyDefinitions = {
  times: alignedProperty(
    z.number().int(),
    (sample) => sample.point.time,
    (sample, value) => (sample.point.time = value),
  ),
  groundSpeedKt: alignedProperty(
    z.number(),
    (sample) => sample.point.groundSpeedKt,
    (sample, value) => (sample.point.groundSpeedKt = value),
  ),
  trackDeg: alignedProperty(
    z.number(),
    (sample) => sample.point.trackDeg,
    (sample, value) => (sample.point.trackDeg = value),
  ),
  ground: alignedProperty(
    z.boolean(),
    (sample) => sample.point.ground,
    (sample, value) => (sample.point.ground = value),
  ),
  estimated: alignedProperty(
    z.boolean(),
    (sample) => sample.incomingEdge.estimated,
    (sample, value) => (sample.incomingEdge.estimated = value),
  ),
} as const;

type AlignedPropertySchemas<
  Definitions extends Record<string, { schema: z.ZodType }>,
> = {
  [Key in keyof Definitions]: z.ZodOptional<
    z.ZodArray<Definitions[Key]['schema']>
  >;
};

const flightTrackAlignedPropertySchemas = Object.fromEntries(
  Object.entries(flightTrackAlignedPropertyDefinitions).map(
    ([key, definition]) => [
      key,
      definition.schema.array().max(MAX_STORED_FLIGHT_TRACK_POINTS).optional(),
    ],
  ),
) as AlignedPropertySchemas<typeof flightTrackAlignedPropertyDefinitions>;
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
    if (values !== undefined) {
      Object.assign(properties, { [key]: values });
    }
  }

  return properties;
};

export const toFlightTrackSamples = (
  track: FlightTrackPayloadSource,
): FlightTrackSample[] => {
  const samples = track.coordinates.map((coordinate) => ({
    coordinate,
    point: {},
    incomingEdge: {},
  }));

  for (const key of flightTrackAlignedPropertyKeys) {
    const values = track[key];
    if (values === undefined) continue;
    const definition = flightTrackAlignedPropertyDefinitions[key];
    values.forEach((value, index) => definition.set(samples[index]!, value));
  }

  return samples;
};

const collectSampleProperty = <T>(
  samples: FlightTrackSample[],
  getValue: (sample: FlightTrackSample) => T | undefined,
) => {
  const values = samples.map(getValue);
  if (values.every((value) => value === undefined)) return undefined;
  if (values.some((value) => value === undefined)) {
    throw new Error('Track sample properties must be present for every point');
  }
  return values as T[];
};

export const fromFlightTrackSamples = (
  samples: FlightTrackSample[],
): FlightTrackPayload => {
  const properties: FlightTrackAlignedProperties = {};

  for (const key of flightTrackAlignedPropertyKeys) {
    const definition = flightTrackAlignedPropertyDefinitions[key];
    const values = collectSampleProperty(samples, definition.get);
    if (values !== undefined) {
      Object.assign(properties, { [key]: values });
    }
  }

  return {
    coordinates: samples.map((sample) => sample.coordinate),
    ...properties,
  };
};

export const pickFlightTrackPoints = (
  track: FlightTrackPayload,
  indices: number[],
): FlightTrackPayload => {
  const properties: FlightTrackAlignedProperties = {};

  for (const key of flightTrackAlignedPropertyKeys) {
    const values = track[key];
    if (values !== undefined) {
      Object.assign(properties, {
        [key]: indices.map((index) => values[index]!),
      });
    }
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
