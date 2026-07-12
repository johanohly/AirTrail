import {
  fromFlightTrackSamples,
  MAX_RENDERED_FLIGHT_TRACK_POINTS,
  toFlightTrackSamples,
  type FlightTrackPayload,
  type FlightTrackSample,
} from './schema';

const METERS_PER_DEGREE = 111_320;
const SPATIAL_CORNER_THRESHOLD_METERS = 10;
// tar1090 subtracts up to 60 seconds between history samples, then applies
// a 15-second airborne or 30-second ground stale timeout.
const AIRBORNE_ESTIMATED_GAP_SECONDS = 75;
const GROUND_ESTIMATED_GAP_SECONDS = 90;

const materializeEstimatedGaps = (
  samples: FlightTrackSample[],
): FlightTrackSample[] => {
  if (!samples.some((sample) => sample.point.time !== undefined)) {
    return samples;
  }

  let result = samples;

  for (let index = 1; index < samples.length; index++) {
    const previousTime = samples[index - 1]?.point.time;
    const currentTime = samples[index]?.point.time;
    if (previousTime === undefined || currentTime === undefined) continue;

    const timeout = samples[index]?.point.ground
      ? GROUND_ESTIMATED_GAP_SECONDS
      : AIRBORNE_ESTIMATED_GAP_SECONDS;
    if (Math.abs(currentTime - previousTime) <= timeout) continue;
    if (samples[index]?.incomingEdge.estimated) continue;

    if (result === samples) {
      result = samples.map((sample) => ({
        ...sample,
        point: { ...sample.point },
        incomingEdge: {
          ...sample.incomingEdge,
          estimated: sample.incomingEdge.estimated ?? false,
        },
      }));
    }
    result[index]!.incomingEdge.estimated = true;
  }

  return result;
};

const addTransitionBoundaries = <T>(
  boundaries: Set<number>,
  values: T[] | undefined,
) => {
  if (!values) return;

  for (let index = 1; index < values.length; index++) {
    if (values[index] === values[index - 1]) continue;
    boundaries.add(index);
  }
};

const collectTransitionGroups = (samples: FlightTrackSample[]) => {
  const boundaries = new Set<number>();
  addTransitionBoundaries(
    boundaries,
    samples.map((sample) => sample.point.ground),
  );
  addTransitionBoundaries(
    boundaries,
    samples.map((sample) => sample.incomingEdge.estimated),
  );
  addTransitionBoundaries(
    boundaries,
    samples.map((sample) => sample.coordinate[2] !== undefined),
  );

  const sorted = [...boundaries].sort((a, b) => a - b);
  const groups: number[][] = [];

  for (const boundary of sorted) {
    const previous = groups.at(-1);
    if (previous?.at(-1) === boundary - 1) {
      previous.push(boundary);
    } else {
      groups.push([boundary - 1, boundary]);
    }
  }

  return groups;
};

const getAltitude = (samples: FlightTrackSample[], index: number) =>
  samples[index]?.coordinate[2] ?? null;

const collectAltitudeIndices = (samples: FlightTrackSample[]) => {
  const selected = new Set<number>();

  for (let index = 1; index < samples.length - 1; index++) {
    const previous = getAltitude(samples, index - 1);
    const current = getAltitude(samples, index);
    const next = getAltitude(samples, index + 1);

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

const collectSpatialCornerIndices = (samples: FlightTrackSample[]) => {
  const selected = new Set<number>();
  const referenceLat =
    samples.reduce((sum, sample) => sum + sample.coordinate[1], 0) /
    samples.length;
  const xScale = METERS_PER_DEGREE * Math.cos((referenceLat * Math.PI) / 180);
  const points = samples.map(
    ({ coordinate: [lon, lat] }) =>
      [lon * xScale, lat * METERS_PER_DEGREE] as const,
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

const takeEvenly = <T>(values: T[], count: number) => {
  if (values.length <= count) return values;
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, slot) => {
    const position = Math.floor(((slot + 0.5) * values.length) / count);
    return values[Math.min(position, values.length - 1)]!;
  });
};

const addTransitionGroupsUntilFull = (
  selected: Set<number>,
  groups: number[][],
  maxPoints: number,
) => {
  let candidates = groups;

  while (candidates.length > 0) {
    const remaining = maxPoints - selected.size;
    const fitting = candidates.filter(
      (group) =>
        group.filter((index) => !selected.has(index)).length <= remaining,
    );
    if (fitting.length === 0) return;

    const batch = takeEvenly(
      fitting,
      Math.min(fitting.length, Math.max(1, Math.floor(remaining / 2))),
    );
    let added = false;

    for (const group of batch) {
      const missing = group.filter((index) => !selected.has(index));
      if (missing.length > maxPoints - selected.size) continue;
      missing.forEach((index) => selected.add(index));
      added = true;
    }

    if (!added) return;
    const addedGroups = new Set(batch);
    candidates = candidates.filter((group) => !addedGroups.has(group));
  }
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
  const samples = toFlightTrackSamples(track);
  const renderSamples = materializeEstimatedGaps(samples);

  if (renderSamples.length <= maxPoints) {
    return renderSamples === samples
      ? track
      : fromFlightTrackSamples(renderSamples);
  }
  if (maxPoints < 2) throw new RangeError('A rendered track needs two points');

  const lastIndex = renderSamples.length - 1;
  const transitionGroups = collectTransitionGroups(renderSamples);
  const semanticIndices = new Set<number>([0, lastIndex]);
  transitionGroups.forEach((group) =>
    group.forEach((index) => semanticIndices.add(index)),
  );

  if (semanticIndices.size > maxPoints) {
    const selected = new Set([0, lastIndex]);
    addTransitionGroupsUntilFull(selected, transitionGroups, maxPoints);
    return fromFlightTrackSamples(
      [...selected].sort((a, b) => a - b).map((index) => renderSamples[index]!),
    );
  }

  addUntilFull(
    semanticIndices,
    collectAltitudeIndices(renderSamples),
    maxPoints,
  );
  addUntilFull(
    semanticIndices,
    collectSpatialCornerIndices(renderSamples),
    maxPoints,
  );
  addUntilFull(
    semanticIndices,
    Array.from({ length: renderSamples.length }, (_, index) => index),
    maxPoints,
  );

  return fromFlightTrackSamples(
    [...semanticIndices]
      .sort((a, b) => a - b)
      .map((index) => renderSamples[index]!),
  );
};
