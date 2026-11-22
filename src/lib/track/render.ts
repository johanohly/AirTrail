import {
  createGreatCircleArc,
  projectOntoArc,
  sphericalDistance,
  toUnitVector,
} from './great-circle';
import {
  fromFlightTrackSamples,
  toFlightTrackSamples,
  type FlightTrackPayload,
  type FlightTrackSample,
} from './schema';

const HORIZONTAL_TOLERANCE_METERS = 30;
const VERTICAL_TOLERANCE_METERS = 15;

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

const preserveAsGround = ({ point, coordinate }: FlightTrackSample) =>
  point.ground ?? coordinate[2] === 0;

const collectMandatoryIndices = (samples: FlightTrackSample[]) => {
  const indices = [0];
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const ground = preserveAsGround(current);
    // Preserve both ends of each estimated edge and the return to solid edges.
    if (
      current.incomingEdge.estimated ||
      previous.incomingEdge.estimated ||
      ground !== preserveAsGround(previous) ||
      (current.coordinate[2] === undefined) !==
        (previous.coordinate[2] === undefined)
    ) {
      if (indices.at(-1) !== index - 1) indices.push(index - 1);
      indices.push(index);
    } else if (ground || index === samples.length - 1) {
      indices.push(index);
    }
  }
  return indices;
};

type Span = readonly [start: number, end: number];
type WorstPoint = (start: number, end: number) => number | undefined;

const spansBetween = (indices: number[]): Span[] =>
  indices.slice(1).map((end, offset) => [indices[offset]!, end]);

const refine = (
  spans: Span[],
  selected: Set<number>,
  worstPoint: WorstPoint,
) => {
  const pending = [...spans];
  while (pending.length) {
    const [start, end] = pending.pop()!;
    if (end - start < 2) continue;
    const index = worstPoint(start, end);
    if (index === undefined) continue;
    selected.add(index);
    pending.push([index, end], [start, index]);
  }
};

const altitudeError = (
  altitude: number,
  start: number,
  end: number,
  progress: number | undefined,
) => {
  if (progress === undefined) {
    // Distance cannot describe a change in altitude at one position.
    return start === end ? Math.abs(altitude - start) : Infinity;
  }
  return Math.abs(altitude - (start * (1 - progress) + end * progress));
};

export const reduceFlightTrackForMap = (
  track: FlightTrackPayload,
): FlightTrackPayload => {
  const samples = toFlightTrackSamples(track);
  const renderSamples = materializeEstimatedGaps(samples);
  if (samples.length < 2) return track;

  const mandatory = collectMandatoryIndices(renderSamples);
  const spans = spansBetween(mandatory).filter(
    ([start, end]) => end - start > 1,
  );
  if (!spans.length) {
    return renderSamples === samples
      ? track
      : fromFlightTrackSamples(renderSamples);
  }

  const vectors = samples.map(({ coordinate: [lon, lat] }) =>
    toUnitVector(lon, lat),
  );
  const altitudes = samples.map(({ coordinate }) => coordinate[2]);
  const distances = [0];
  for (let index = 1; index < vectors.length; index++) {
    distances.push(
      distances[index - 1]! +
        sphericalDistance(vectors[index - 1]!, vectors[index]!),
    );
  }

  const findWorstPoint = (
    start: number,
    end: number,
    mode: 'horizontal' | 'vertical' | 'combined',
  ) => {
    const startAltitude = altitudes[start];
    const endAltitude = altitudes[end];
    const checkVertical =
      mode !== 'horizontal' &&
      startAltitude !== undefined &&
      endAltitude !== undefined;
    const arc =
      mode === 'vertical'
        ? undefined
        : createGreatCircleArc(vectors[start]!, vectors[end]!);
    if (arc?.kind === 'antipodal') {
      // Keep an observation to disambiguate the route rather than choosing an arc.
      return start + Math.floor((end - start) / 2);
    }
    const spanDistance = distances[end]! - distances[start]!;

    let worstIndex: number | undefined;
    let worstScore = 1;
    for (let index = start + 1; index < end; index++) {
      const point = vectors[index]!;
      const projection =
        arc?.kind === 'arc' ? projectOntoArc(arc, point) : undefined;
      let score = arc
        ? (projection?.distance ?? sphericalDistance(vectors[start]!, point)) /
          HORIZONTAL_TOLERANCE_METERS
        : 0;
      if (checkVertical) {
        const altitude = altitudes[index]!;
        const progress =
          spanDistance === 0
            ? undefined
            : (distances[index]! - distances[start]!) / spanDistance;
        let error = altitudeError(
          altitude,
          startAltitude,
          endAltitude,
          progress,
        );
        if (mode === 'combined') {
          error = Math.max(
            error,
            altitudeError(
              altitude,
              startAltitude,
              endAltitude,
              projection?.progress,
            ),
          );
        }
        score = Math.max(score, error / VERTICAL_TOLERANCE_METERS);
      }
      if (score > worstScore) {
        worstIndex = index;
        worstScore = score;
      }
    }
    return worstIndex;
  };

  // Each independent pass starts from the same mandatory boundaries.
  const selected = new Set(mandatory);
  refine(spans, selected, (start, end) =>
    findWorstPoint(start, end, 'horizontal'),
  );
  refine(spans, selected, (start, end) =>
    findWorstPoint(start, end, 'vertical'),
  );
  // A point added by either pass changes the reconstruction of both.
  const combined = [...selected].sort((a, b) => a - b);
  refine(spansBetween(combined), selected, (start, end) =>
    findWorstPoint(start, end, 'combined'),
  );

  if (selected.size === samples.length && renderSamples === samples)
    return track;
  return fromFlightTrackSamples(
    [...selected].sort((a, b) => a - b).map((index) => renderSamples[index]!),
  );
};
