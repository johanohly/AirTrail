import type { Airport } from '$lib/utils/data/airports';

type Vec3 = [number, number, number];
type WeightedAirport = { vector: Vec3; weight: number };

export type GlobeFitArc = {
  from: Airport;
  to: Airport;
  frequency?: number;
};

export type GlobeFitViewport = {
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
};

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

// MapLibre's default vertical field of view (transform._fovInRadians); the
// camera sits at 0.5 * height / tan(fov / 2) pixels from the map center.
const FOV_TAN_HALF = Math.tan(0.6435011087932844 / 2);
// Past this cap radius no single globe view can contain every airport (the
// visible rim sits at ~70° from the view center at whole-disc zoom), so the
// view becomes a planet overview centered on where the user flies most.
const FULL_VIEW_RADIUS = 70 * DEGREES_TO_RADIANS;
// Keeps the zoom finite when every flight touches a single airport.
const MIN_CAP_RADIUS = 0.5 * DEGREES_TO_RADIANS;

const toUnitVector = (airport: Airport): Vec3 => {
  const lat = airport.lat * DEGREES_TO_RADIANS;
  const lon = airport.lon * DEGREES_TO_RADIANS;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
};

const normalize = (v: Vec3): Vec3 | undefined => {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-9) return undefined;
  return [v[0] / length, v[1] / length, v[2] / length];
};

const angleBetween = (a: Vec3, b: Vec3) =>
  Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

const collectAirports = (data: GlobeFitArc[]): WeightedAirport[] => {
  const byId = new Map<number, WeightedAirport>();
  for (const arc of data) {
    const weight = arc.frequency ?? 1;
    for (const airport of [arc.from, arc.to]) {
      const existing = byId.get(airport.id);
      if (existing) {
        existing.weight += weight;
      } else {
        byId.set(airport.id, { vector: toUnitVector(airport), weight });
      }
    }
  }
  return [...byId.values()];
};

const meanDirection = (
  airports: WeightedAirport[],
  weighted: boolean,
): Vec3 | undefined => {
  const sum: Vec3 = [0, 0, 0];
  for (const { vector, weight } of airports) {
    const w = weighted ? weight : 1;
    sum[0] += vector[0] * w;
    sum[1] += vector[1] * w;
    sum[2] += vector[2] * w;
  }
  return normalize(sum);
};

const capRadius = (center: Vec3, airports: WeightedAirport[]) => {
  let radius = 0;
  for (const { vector } of airports) {
    radius = Math.max(radius, angleBetween(center, vector));
  }
  return radius;
};

// Smallest-ish spherical cap containing every arc endpoint: centered on the
// normalized mean of the airports' unit vectors, radius the max angular
// distance to any of them. Every point of a great-circle arc lies within
// the cap of its endpoints, so covering the airports covers the routes.
const sphericalCapForArcs = (data: GlobeFitArc[]) => {
  const airports = collectAirports(data);
  if (!airports.length) return undefined;

  // A perfectly balanced antipodal spread has no mean direction; any
  // airport is then as good a center as any other.
  let center = meanDirection(airports, false) ?? airports[0]!.vector;
  let radius = capRadius(center, airports);

  if (radius > FULL_VIEW_RADIUS) {
    // No single view exists, so only the choice of hemisphere matters:
    // bias it toward the airports with the most flights.
    const weightedCenter = meanDirection(airports, true);
    if (weightedCenter) {
      center = weightedCenter;
      radius = capRadius(center, airports);
    }
  }

  return { center, radius: Math.max(radius, MIN_CAP_RADIUS) };
};

/**
 * Camera (center + zoom) that best shows the given arcs on the MapLibre
 * globe. When everything fits a single view this is an exact fit, like
 * fitBounds; when the arcs span more than a visible hemisphere it degrades
 * to a whole-planet view centered on the flight-frequency-weighted centroid
 * (a bounding-box fitBounds silently fails in that case).
 *
 * The returned center is the raw cap center: pass the same padding to
 * easeTo/flyTo (or set it persistently) so the camera places it at the
 * padded viewport center.
 */
export const globeCameraForArcs = (
  data: GlobeFitArc[],
  viewport: GlobeFitViewport,
): { center: [number, number]; zoom: number } | undefined => {
  const cap = sphericalCapForArcs(data);
  if (!cap) return undefined;

  const { width, height, padding } = viewport;
  if (!(width > 0) || !(height > 0)) return undefined;
  const available = Math.min(
    width - padding.left - padding.right,
    height - padding.top - padding.bottom,
  );
  // Degenerate viewports (padding exceeding the screen) still deserve a
  // sensible view rather than a dead control.
  const halfExtent = Math.max(available, 80) / 2;
  const focalLength = (0.5 * height) / FOV_TAN_HALF;

  // Globe pixel radius at which the cap rim spans the available viewport
  // (screen radius of the rim: focal * R*sin(θ) / (focal + R - R*cos(θ))).
  // The rim equation only holds while the rim is in front of the horizon —
  // past FULL_VIEW_RADIUS it turns around and zooms back in — so wider caps
  // frame the whole disc instead.
  const sin = Math.sin(cap.radius);
  const cos = Math.cos(cap.radius);
  const fitDenominator = focalLength * sin + halfExtent * (cos - 1);
  const globeRadius =
    cap.radius < FULL_VIEW_RADIUS && fitDenominator > 0
      ? (halfExtent * focalLength) / fitDenominator
      : (halfExtent * halfExtent +
          halfExtent * Math.hypot(halfExtent, focalLength)) /
        focalLength;

  const lat =
    Math.asin(Math.max(-1, Math.min(1, cap.center[2]))) * RADIANS_TO_DEGREES;
  const lng = Math.atan2(cap.center[1], cap.center[0]) * RADIANS_TO_DEGREES;
  // MapLibre's getGlobeRadiusPixels: radius = worldSize / 2π / cos(lat),
  // with worldSize = 512 * 2^zoom.
  const zoom = Math.log2(
    (globeRadius * 2 * Math.PI * Math.cos(lat * DEGREES_TO_RADIANS)) / 512,
  );

  return { center: [lng, lat], zoom };
};
