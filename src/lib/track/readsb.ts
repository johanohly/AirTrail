import type { FlightTrackCoordinate, FlightTrackPayload } from './schema';

const TRACE_FIELD = {
  offset: 0,
  latitude: 1,
  longitude: 2,
  altitude: 3,
  groundSpeed: 4,
  track: 5,
  flags: 6,
} as const;

const TRACE_FLAG = {
  stale: 1 << 0,
  legStart: 1 << 1,
} as const;

type ReadsbTracePoint = {
  coordinate: FlightTrackCoordinate;
  time: number;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  ground: boolean;
  estimated: boolean;
  legStart: boolean;
};

export type ReadsbTrackLeg = {
  legIndex: number;
  track: FlightTrackPayload;
};

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const normalizeTrackDegrees = (value: number) => ((value % 360) + 360) % 360;

const parseTracePoint = (
  value: unknown,
  index: number,
  baseTimestamp: number,
): ReadsbTracePoint => {
  if (!Array.isArray(value)) {
    throw new Error(`readsb trace point ${index + 1} is not a tuple`);
  }

  const offset = toFiniteNumber(value[TRACE_FIELD.offset]);
  const lat = toFiniteNumber(value[TRACE_FIELD.latitude]);
  const lon = toFiniteNumber(value[TRACE_FIELD.longitude]);
  if (offset === null || lat === null || lon === null) {
    throw new Error(
      `readsb trace point ${index + 1} needs finite offset, latitude, and longitude values`,
    );
  }

  const altitudeValue = value[TRACE_FIELD.altitude];
  const altitude = toFiniteNumber(altitudeValue);
  const ground = altitudeValue === 'ground';
  const coordinate: FlightTrackCoordinate = ground
    ? [lon, lat, 0]
    : altitude === null
      ? [lon, lat]
      : [lon, lat, altitude * 0.3048];
  const flags = Math.trunc(toFiniteNumber(value[TRACE_FIELD.flags]) ?? 0);
  const track = toFiniteNumber(value[TRACE_FIELD.track]);

  return {
    coordinate,
    time: Math.round(baseTimestamp + offset),
    groundSpeedKt: toFiniteNumber(value[TRACE_FIELD.groundSpeed]),
    trackDeg: track === null ? null : normalizeTrackDegrees(track),
    ground,
    estimated: (flags & TRACE_FLAG.stale) !== 0,
    legStart: (flags & TRACE_FLAG.legStart) !== 0,
  };
};

const toTrack = (points: ReadsbTracePoint[]): FlightTrackPayload => {
  const groundSpeedKt = points.map((point) => point.groundSpeedKt);
  const trackDeg = points.map((point) => point.trackDeg);

  return {
    coordinates: points.map((point) => point.coordinate),
    times: points.map((point) => point.time),
    groundSpeedKt: groundSpeedKt.every(
      (value): value is number => value !== null,
    )
      ? groundSpeedKt
      : undefined,
    trackDeg: trackDeg.every((value): value is number => value !== null)
      ? trackDeg
      : undefined,
    ground: points.map((point) => point.ground),
    estimated: points.map((point) => point.estimated),
  };
};

export const parseReadsbTrackLegs = (content: string): ReadsbTrackLeg[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid readsb trace JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid readsb trace JSON');
  }

  const trace = (parsed as { trace?: unknown }).trace;
  const baseTimestamp = toFiniteNumber(
    (parsed as { timestamp?: unknown }).timestamp,
  );
  if (!Array.isArray(trace) || baseTimestamp === null) {
    throw new Error('readsb trace JSON needs timestamp and trace fields');
  }

  const points = trace.map((value, index) =>
    parseTracePoint(value, index, baseTimestamp),
  );
  if (points.length < 2) {
    throw new Error('readsb trace must contain at least two usable points');
  }

  const legStarts = [
    0,
    ...points.flatMap((point, index) =>
      index > 0 && point.legStart ? [index] : [],
    ),
  ];
  const legs = legStarts
    .map((start, index) => ({
      legIndex: index + 1,
      points: points.slice(start, legStarts[index + 1]),
    }))
    .filter((leg) => leg.points.length >= 2)
    .map(({ legIndex, points }) => ({ legIndex, track: toTrack(points) }));

  if (legs.length === 0) {
    throw new Error('readsb trace has no flight leg with at least two points');
  }

  return legs;
};
