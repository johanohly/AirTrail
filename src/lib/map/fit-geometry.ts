import type { Airport } from '$lib/db/types';
import { createGreatCircleArc, toUnitVector } from '$lib/track/great-circle';

export type Vec3 = readonly [number, number, number];

export type FitRoute = {
  from: Airport;
  to: Airport;
  frequency?: number;
};

/*
 * What a camera fit has to keep on screen: the routes drawn as great-circle
 * arcs, and the recorded tracks drawn in place of the others. Each track keeps
 * its route so its airports still count, and so near-global sets can still
 * be weighted by where the user flies most.
 */
export type FitShape = {
  arcs: FitRoute[];
  tracks: { route: FitRoute; path: readonly (readonly number[])[] }[];
};

const DEGREES = Math.PI / 180;
// Great circles bulge poleward on mercator and curve on the globe, so a fit
// samples them finely enough that the box or cap around the samples is within
// a pixel or two of the drawn line.
const MAX_SAMPLE_STEP = 1 * DEGREES;
// Recorded tracks carry up to thousands of points each. Points closer than
// this to the last one kept move the fit by a few pixels at most, and
// skipping them keeps a fit over hundreds of tracks quick.
const MIN_TRACK_STEP_COS = Math.cos(0.1 * DEGREES);

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalize = (v: Vec3): Vec3 | undefined => {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-12) return undefined;
  return [v[0] / length, v[1] / length, v[2] / length];
};

const airportVector = (airport: Airport) =>
  toUnitVector(airport.lon, airport.lat);

const pushGreatCircle = (points: Vec3[], start: Vec3, end: Vec3) => {
  const arc = createGreatCircleArc(start, end);
  // An antipodal pair has no single great circle; its endpoints are all a
  // fit can rely on.
  if (arc.kind !== 'arc') return;
  const steps = Math.ceil(arc.angle / MAX_SAMPLE_STEP);
  for (let step = 1; step < steps; step++) {
    const angle = (arc.angle * step) / steps;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push([
      start[0] * cos + arc.tangent[0] * sin,
      start[1] * cos + arc.tangent[1] * sin,
      start[2] * cos + arc.tangent[2] * sin,
    ]);
  }
};

/*
 * The drawn geometry as lines of unit vectors: each arc and track sampled
 * along its great circles, and each airport as a line of its own.
 */
const sampleFitLines = (shape: FitShape): Vec3[][] => {
  const lines: Vec3[][] = [];
  const airportIds = new Set<number>();
  const addAirport = (airport: Airport) => {
    if (airportIds.has(airport.id)) return;
    airportIds.add(airport.id);
    lines.push([airportVector(airport)]);
  };

  for (const arc of shape.arcs) {
    addAirport(arc.from);
    addAirport(arc.to);
    const start = airportVector(arc.from);
    const end = airportVector(arc.to);
    const line = [start];
    pushGreatCircle(line, start, end);
    line.push(end);
    lines.push(line);
  }

  for (const { route, path } of shape.tracks) {
    addAirport(route.from);
    addAirport(route.to);
    const line: Vec3[] = [];
    path.forEach((coordinate, index) => {
      const point = toUnitVector(coordinate[0]!, coordinate[1]!);
      const previous = line.at(-1);
      if (previous) {
        const last = index === path.length - 1;
        if (!last && dot(previous, point) > MIN_TRACK_STEP_COS) return;
        pushGreatCircle(line, previous, point);
      }
      line.push(point);
    });
    lines.push(line);
  }

  return lines;
};

/** Unit vectors covering every drawn airport, arc and track. */
export const sampleFitShape = (shape: FitShape): Vec3[] =>
  sampleFitLines(shape).flat();

/** Airports with the number of flights touching them, for weighting. */
const weightedFitAirports = (shape: FitShape) => {
  const byId = new Map<number, { vector: Vec3; weight: number }>();
  const add = (route: FitRoute, weight: number) => {
    for (const airport of [route.from, route.to]) {
      const existing = byId.get(airport.id);
      if (existing) existing.weight += weight;
      else byId.set(airport.id, { vector: airportVector(airport), weight });
    }
  };
  for (const arc of shape.arcs) add(arc, arc.frequency ?? 1);
  for (const track of shape.tracks) add(track.route, 1);
  return [...byId.values()];
};

export const toLngLat = (v: Vec3): [number, number] => [
  Math.atan2(v[1], v[0]) / DEGREES,
  Math.atan2(v[2], Math.hypot(v[0], v[1])) / DEGREES,
];

/** Frequency-weighted mean direction of the airports. */
export const weightedFitCenter = (shape: FitShape): Vec3 | undefined => {
  const sum: [number, number, number] = [0, 0, 0];
  for (const { vector, weight } of weightedFitAirports(shape)) {
    sum[0] += vector[0] * weight;
    sum[1] += vector[1] * weight;
    sum[2] += vector[2] * weight;
  }
  return normalize(sum);
};

const wrapLongitude = (longitude: number) => ((longitude % 360) + 360) % 360;

/*
 * Mercator bounds of the drawn geometry. Longitudes are taken around the
 * largest stretch no line crosses, so a set over the antimeridian is one box
 * east of 180° rather than a box spanning the world the other way. When the
 * lines circle the whole planet there is no such stretch: the box then spans
 * all 360°, centered on where the user flies most, so the seam at the edges
 * falls on the far side of the world from them.
 */
export const fitShapeBounds = (
  shape: FitShape,
): [[number, number], [number, number]] | undefined => {
  const lines = sampleFitLines(shape);
  if (!lines.length) return undefined;

  let south = Infinity;
  let north = -Infinity;
  // Longitude intervals the lines cover, each starting in [0°, 360°).
  const covered: [number, number][] = [];
  for (const line of lines) {
    let previous: number | undefined;
    for (const point of line) {
      const [lng, lat] = toLngLat(point);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      if (previous === undefined) {
        covered.push([wrapLongitude(lng), wrapLongitude(lng)]);
      } else {
        const step = ((lng - previous + 540) % 360) - 180;
        const start = wrapLongitude(Math.min(previous, previous + step));
        covered.push([start, start + Math.abs(step)]);
      }
      previous = lng;
    }
  }

  // Sweep two turns so the intervals that wrap past 360° cover the start of
  // the second turn, and count each gap once, by where it ends. Gaps from
  // rounding where two segments meet are not gaps.
  const sweep = [
    ...covered,
    ...covered.map(([start, end]): [number, number] => [
      start + 360,
      end + 360,
    ]),
  ].sort((a, b) => a[0] - b[0]);
  let reach = -Infinity;
  let gapStart = 0;
  let gap = 0;
  for (const [start, end] of sweep) {
    if (start >= 360 && start - reach > Math.max(gap, 1e-9)) {
      gap = start - reach;
      gapStart = reach;
    }
    reach = Math.max(reach, end);
  }

  if (gap === 0) {
    const center = weightedFitCenter(shape);
    const west = (center ? toLngLat(center)[0] : 0) - 180;
    return [
      [west, south],
      [west + 360, north],
    ];
  }

  let west = wrapLongitude(gapStart + gap);
  if (west >= 180) west -= 360;
  return [
    [west, south],
    [west + 360 - gap, north],
  ];
};

type Cap = { center: Vec3; cos: number };

const CAP_TOLERANCE = 1e-12;

const contains = (cap: Cap, point: Vec3) =>
  dot(cap.center, point) >= cap.cos - CAP_TOLERANCE;

const capThrough2 = (a: Vec3, b: Vec3): Cap | undefined => {
  const center = normalize([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
  return center && { center, cos: dot(center, a) };
};

const capThrough3 = (a: Vec3, b: Vec3, c: Vec3): Cap | undefined => {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = normalize([
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ]);
  if (!normal) return undefined;
  // The plane through three points cuts two caps; the fit wants the smaller.
  const center: Vec3 =
    dot(normal, a) >= 0 ? normal : [-normal[0], -normal[1], -normal[2]];
  return { center, cos: dot(center, a) };
};

// Rounds of the approximate cap below. Its radius is within a few percent of
// the smallest cap's, plenty to tell whether the points fit in a hemisphere.
const ROUGH_CAP_ROUNDS = 32;

/*
 * Bădoiu and Clarkson's approximation of the smallest cap: step the center
 * toward the farthest point by a shrinking fraction of the way. Returns
 * whether every point ends up strictly inside the hemisphere around it.
 */
const fitsHemisphere = (points: Vec3[]) => {
  let center = points[0]!;
  for (let round = 1; ; round++) {
    let farthest = center;
    let lowest = 1;
    for (const point of points) {
      const cos = dot(center, point);
      if (cos < lowest) {
        lowest = cos;
        farthest = point;
      }
    }
    if (round > ROUGH_CAP_ROUNDS) return lowest > 0;

    const angle = Math.acos(Math.max(-1, lowest));
    const sin = Math.sin(angle);
    if (sin < 1e-9) return lowest > 0;
    const toward = Math.sin(angle / (round + 1)) / sin;
    const away = Math.sin(angle - angle / (round + 1)) / sin;
    center = [
      center[0] * away + farthest[0] * toward,
      center[1] * away + farthest[1] * toward,
      center[2] * away + farthest[2] * toward,
    ];
  }
};

/*
 * Smallest spherical cap containing every point (Welzl's algorithm, which
 * carries over from circles to caps while the points fit in a hemisphere).
 * Unlike the mean of the points, its center does not drift toward where most
 * points are, so a hub with many short routes cannot pull the view off the
 * long ones. Returns undefined when no cap smaller than a hemisphere exists:
 * Welzl's algorithm needs the points in one hemisphere, and outside it can
 * take quadratic time before failing.
 */
export const smallestEnclosingCap = (
  points: Vec3[],
  random: () => number = Math.random,
): { center: Vec3; radius: number } | undefined => {
  if (!points.length || !fitsHemisphere(points)) return undefined;
  const shuffled = [...points];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }

  let cap: Cap = { center: shuffled[0]!, cos: 1 };
  for (let i = 1; i < shuffled.length; i++) {
    const p = shuffled[i]!;
    if (contains(cap, p)) continue;
    cap = { center: p, cos: 1 };
    for (let j = 0; j < i; j++) {
      const q = shuffled[j]!;
      if (contains(cap, q)) continue;
      const pair = capThrough2(p, q);
      if (!pair) return undefined;
      cap = pair;
      for (let k = 0; k < j; k++) {
        const r = shuffled[k]!;
        if (contains(cap, r)) continue;
        const triple = capThrough3(p, q, r);
        if (!triple) return undefined;
        cap = triple;
      }
    }
  }

  if (cap.cos <= 0 || !shuffled.every((point) => contains(cap, point))) {
    return undefined;
  }
  return {
    center: cap.center,
    radius: Math.acos(Math.min(1, cap.cos)),
  };
};
