import {
  createGreatCircleArc,
  projectOntoArc,
  sphericalDistance,
  toUnitVector,
} from './great-circle';
import {
  fromFlightTrackSamples,
  MAX_RENDERED_FLIGHT_TRACK_POINTS,
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

const collectMandatoryIndices = (
  samples: FlightTrackSample[],
  keepGround: boolean,
) => {
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
    } else if ((keepGround && ground) || index === samples.length - 1) {
      indices.push(index);
    }
  }
  return indices;
};

type Span = readonly [start: number, end: number];
type Candidate = { index: number; score: number };
type Split = Candidate & { start: number; end: number };
type FindWorstPoint = (start: number, end: number) => Candidate | undefined;

const spansBetween = (indices: number[]): Span[] =>
  indices.slice(1).map((end, offset) => [indices[offset]!, end]);

const refine = (
  mandatory: number[],
  maxPoints: number,
  findWorstPoint: FindWorstPoint,
) => {
  const selected = new Set(mandatory);
  // Once the selection exceeds the budget, finishing this pass cannot make it
  // fit.
  const pending = spansBetween(mandatory);
  while (pending.length && selected.size <= maxPoints) {
    const [start, end] = pending.pop()!;
    const candidate = findWorstPoint(start, end);
    if (!candidate) continue;
    const { index } = candidate;
    selected.add(index);
    pending.push([index, end], [start, index]);
  }
  return selected;
};

const higherPriority = (a: Split, b: Split) => {
  if (a.score !== b.score) return a.score > b.score;
  // With equal error, distribute points across the longer spans first.
  const aLength = a.end - a.start;
  const bLength = b.end - b.start;
  return aLength === bLength ? a.index < b.index : aLength > bLength;
};

const refineToBudget = (
  mandatory: number[],
  maxPoints: number,
  findWorstPoint: FindWorstPoint,
) => {
  const selected = new Set(mandatory);
  // Required observations take precedence over the nominal point budget.
  if (selected.size >= maxPoints) return selected;

  // The heap stores one split candidate per span that still exceeds H30/V15.
  const heap: Split[] = [];
  const enqueue = (start: number, end: number) => {
    const candidate = findWorstPoint(start, end);
    if (!candidate) return;
    const split = { ...candidate, start, end };
    let slot = heap.length;
    heap.push(split);
    while (slot > 0) {
      const parent = Math.floor((slot - 1) / 2);
      if (!higherPriority(split, heap[parent]!)) break;
      heap[slot] = heap[parent]!;
      slot = parent;
    }
    heap[slot] = split;
  };

  const dequeue = () => {
    const highest = heap[0]!;
    const last = heap.pop()!;
    if (!heap.length) return highest;

    let slot = 0;
    while (2 * slot + 1 < heap.length) {
      const left = 2 * slot + 1;
      const right = left + 1;
      const child =
        right < heap.length && higherPriority(heap[right]!, heap[left]!)
          ? right
          : left;
      if (!higherPriority(heap[child]!, last)) break;
      heap[slot] = heap[child]!;
      slot = child;
    }
    heap[slot] = last;
    return highest;
  };

  for (const [start, end] of spansBetween(mandatory)) enqueue(start, end);
  while (heap.length && selected.size < maxPoints) {
    const { start, end, index } = dequeue();
    selected.add(index);
    enqueue(start, index);
    enqueue(index, end);
  }
  return selected;
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
  maxPoints = MAX_RENDERED_FLIGHT_TRACK_POINTS,
): FlightTrackPayload => {
  const samples = toFlightTrackSamples(track);
  if (samples.length < 2) return track;
  // Detect gaps on the original samples before reduction changes point spacing.
  const renderSamples = materializeEstimatedGaps(samples);
  const unchanged = () =>
    renderSamples === samples ? track : fromFlightTrackSamples(renderSamples);

  const vectors = renderSamples.map(({ coordinate: [lon, lat] }) =>
    toUnitVector(lon, lat),
  );
  const altitudes = renderSamples.map(({ coordinate }) => coordinate[2]);

  // A point's score is its worst error relative to the tolerance, so a score
  // above 1 means the retained arc misses it.
  const findWorstPoint = (
    start: number,
    end: number,
    preferBalancedSplits: boolean,
  ): Candidate | undefined => {
    if (end - start < 2) return undefined;
    const midpoint = (start + end) / 2;
    const arc = createGreatCircleArc(vectors[start]!, vectors[end]!);
    if (arc.kind === 'antipodal') {
      // Keep an observation to disambiguate the route rather than choosing an arc.
      return { index: Math.floor(midpoint), score: Infinity };
    }
    const startAltitude = altitudes[start];
    const endAltitude = altitudes[end];

    let worstIndex: number | undefined;
    let worstScore = 1;
    for (let index = start + 1; index < end; index++) {
      const point = vectors[index]!;
      const projection =
        arc.kind === 'arc' ? projectOntoArc(arc, point) : undefined;
      let score =
        (projection?.distance ?? sphericalDistance(vectors[start]!, point)) /
        HORIZONTAL_TOLERANCE_METERS;
      const altitude = altitudes[index];
      if (
        altitude !== undefined &&
        startAltitude !== undefined &&
        endAltitude !== undefined
      ) {
        // The renderer interpolates altitude by position along the retained arc.
        const error = altitudeError(
          altitude,
          startAltitude,
          endAltitude,
          projection?.progress,
        );
        score = Math.max(score, error / VERTICAL_TOLERANCE_METERS);
      }
      // Prefer a balanced split on ties in the budget pass, especially on
      // straight tracks where every point can have the same error.
      if (
        score > worstScore ||
        (preferBalancedSplits &&
          score === worstScore &&
          worstIndex !== undefined &&
          Math.abs(index - midpoint) < Math.abs(worstIndex - midpoint))
      ) {
        worstIndex = index;
        worstScore = score;
      }
    }
    return worstIndex === undefined
      ? undefined
      : { index: worstIndex, score: worstScore };
  };

  let selected = refine(
    collectMandatoryIndices(renderSamples, true),
    maxPoints,
    (start, end) => findWorstPoint(start, end, false),
  );

  if (selected.size > maxPoints) {
    // Noisy loggers and long ground recordings can stay dense at H30/V15.
    // Spend the budget where the error is largest, with ground points
    // competing for it too.
    selected = refineToBudget(
      collectMandatoryIndices(renderSamples, false),
      maxPoints,
      (start, end) => findWorstPoint(start, end, true),
    );
  }

  if (selected.size === renderSamples.length) return unchanged();
  return fromFlightTrackSamples(
    [...selected].sort((a, b) => a - b).map((index) => renderSamples[index]!),
  );
};
