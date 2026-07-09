import {
  MAX_RENDERED_FLIGHT_TRACK_POINTS,
  pickFlightTrackPoints,
  type FlightTrackPayload,
} from './schema';

const METERS_PER_DEGREE = 111_320;
const SPATIAL_CORNER_THRESHOLD_METERS = 10;
// tar1090 subtracts up to 60 seconds between history samples, then applies
// a 15-second airborne or 30-second ground stale timeout.
const AIRBORNE_ESTIMATED_GAP_SECONDS = 75;
const GROUND_ESTIMATED_GAP_SECONDS = 90;

const materializeEstimatedGaps = (
  track: FlightTrackPayload,
): FlightTrackPayload => {
  if (!track.times) return track;

  let estimated = track.estimated;

  for (let index = 1; index < track.coordinates.length; index++) {
    const previousTime = track.times[index - 1];
    const currentTime = track.times[index];
    if (previousTime === undefined || currentTime === undefined) continue;

    const timeout = track.ground?.[index]
      ? GROUND_ESTIMATED_GAP_SECONDS
      : AIRBORNE_ESTIMATED_GAP_SECONDS;
    if (Math.abs(currentTime - previousTime) <= timeout) continue;
    if (estimated?.[index]) continue;

    estimated = estimated ? [...estimated] : track.coordinates.map(() => false);
    estimated[index] = true;
  }

  return estimated === track.estimated ? track : { ...track, estimated };
};

const addTransitionIndices = <T>(
  selected: Set<number>,
  values: T[] | undefined,
) => {
  if (!values) return;

  for (let index = 1; index < values.length; index++) {
    if (values[index] === values[index - 1]) continue;
    selected.add(index - 1);
    selected.add(index);
  }
};

const getAltitude = (track: FlightTrackPayload, index: number) =>
  track.coordinates[index]?.[2] ?? null;

const collectAltitudeIndices = (track: FlightTrackPayload) => {
  const selected = new Set<number>();

  for (let index = 1; index < track.coordinates.length - 1; index++) {
    const previous = getAltitude(track, index - 1);
    const current = getAltitude(track, index);
    const next = getAltitude(track, index + 1);

    if (
      previous === null ||
      current === null ||
      next === null ||
      (current - previous) * (next - current) <= 0
    ) {
      if (previous !== current || current !== next) selected.add(index);
    }
  }

  return selected;
};

const squaredDistanceToSegment = (
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  const projectedX = start[0] + progress * dx;
  const projectedY = start[1] + progress * dy;
  return (point[0] - projectedX) ** 2 + (point[1] - projectedY) ** 2;
};

const collectSpatialCornerIndices = (track: FlightTrackPayload) => {
  const selected = new Set<number>();
  const referenceLat =
    track.coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
    track.coordinates.length;
  const xScale = METERS_PER_DEGREE * Math.cos((referenceLat * Math.PI) / 180);
  const points = track.coordinates.map(
    ([lon, lat]) => [lon * xScale, lat * METERS_PER_DEGREE] as const,
  );
  const thresholdSquared = SPATIAL_CORNER_THRESHOLD_METERS ** 2;

  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    if (squaredDistanceToSegment(current, previous, next) > thresholdSquared) {
      selected.add(index);
    }
  }

  return selected;
};

const takeEvenly = (indices: number[], count: number) => {
  if (indices.length <= count) return indices;
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, slot) => {
    const position = Math.floor(((slot + 0.5) * indices.length) / count);
    return indices[Math.min(position, indices.length - 1)]!;
  });
};

const addUntilFull = (
  selected: Set<number>,
  candidates: Iterable<number>,
  maxPoints: number,
) => {
  const available = [...new Set(candidates)].filter(
    (index) => !selected.has(index),
  );
  const remaining = maxPoints - selected.size;
  takeEvenly(available, remaining).forEach((index) => selected.add(index));
};

export const reduceFlightTrackForMap = (
  track: FlightTrackPayload,
  maxPoints = MAX_RENDERED_FLIGHT_TRACK_POINTS,
): FlightTrackPayload => {
  const renderTrack = materializeEstimatedGaps(track);

  if (renderTrack.coordinates.length <= maxPoints) return renderTrack;
  if (maxPoints < 2) throw new RangeError('A rendered track needs two points');

  const lastIndex = renderTrack.coordinates.length - 1;
  const semanticIndices = new Set<number>([0, lastIndex]);
  addTransitionIndices(semanticIndices, renderTrack.ground);
  addTransitionIndices(semanticIndices, renderTrack.estimated);
  addTransitionIndices(
    semanticIndices,
    renderTrack.coordinates.map((coordinate) => coordinate[2] !== undefined),
  );

  if (semanticIndices.size > maxPoints) {
    const interior = [...semanticIndices]
      .filter((index) => index !== 0 && index !== lastIndex)
      .sort((a, b) => a - b);
    const selected = new Set([0, lastIndex]);
    takeEvenly(interior, maxPoints - 2).forEach((index) => selected.add(index));
    return pickFlightTrackPoints(
      renderTrack,
      [...selected].sort((a, b) => a - b),
    );
  }

  addUntilFull(semanticIndices, collectAltitudeIndices(renderTrack), maxPoints);
  addUntilFull(
    semanticIndices,
    collectSpatialCornerIndices(renderTrack),
    maxPoints,
  );
  addUntilFull(
    semanticIndices,
    Array.from({ length: renderTrack.coordinates.length }, (_, index) => index),
    maxPoints,
  );

  return pickFlightTrackPoints(
    renderTrack,
    [...semanticIndices].sort((a, b) => a - b),
  );
};
