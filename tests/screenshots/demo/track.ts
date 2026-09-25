/**
 * A plausible recorded track for a flight: a great-circle path with a gentle
 * lateral wander, climb and descent phases, and per-point times and ground
 * speeds, shaped like what a GPX logger produces.
 */

type Point = { lat: number; lon: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const distanceKm = (a: Point, b: Point) => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

/** Block time in seconds: taxi and climb overhead plus cruise at ~830 km/h. */
export const estimatedDuration = (from: Point, to: Point) =>
  Math.round((1800 + (distanceKm(from, to) / 830) * 3600) / 300) * 300;

const interpolate = (a: Point, b: Point, f: number): Point => {
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lon);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lon);
  const δ = distanceKm(a, b) / 6371;
  if (δ === 0) return a;
  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
};

const bearing = (a: Point, b: Point) => {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const syntheticTrack = (
  from: Point,
  to: Point,
  departure: Date,
  durationSeconds: number,
) => {
  const points = Math.min(
    600,
    Math.max(120, Math.round(distanceKm(from, to) / 12)),
  );
  const cruiseAltitude = distanceKm(from, to) > 2500 ? 11_600 : 10_400;
  const coordinates: [number, number, number][] = [];
  const times: number[] = [];
  const groundSpeedKt: number[] = [];
  const trackDeg: number[] = [];
  const start = Math.round(departure.getTime() / 1000) + 900;
  const airborne = durationSeconds - 1200;

  for (let i = 0; i < points; i += 1) {
    const f = i / (points - 1);
    const base = interpolate(from, to, f);
    // Real tracks drift off the great circle; keep the endpoints exact.
    const wander = Math.sin(f * Math.PI) * Math.sin(f * Math.PI * 3) * 0.35;
    const next = interpolate(from, to, Math.min(1, f + 0.001));
    const heading = bearing(base, next);
    const lat = base.lat + wander * Math.cos(toRad(heading + 90));
    const lon = base.lon + wander * Math.sin(toRad(heading + 90));
    const climb = Math.min(1, f / 0.08);
    const descent = Math.min(1, (1 - f) / 0.1);
    const altitude = Math.round(cruiseAltitude * Math.min(climb, descent));
    coordinates.push([
      Number(lon.toFixed(5)),
      Number(lat.toFixed(5)),
      altitude,
    ]);
    times.push(start + Math.round(f * airborne));
    groundSpeedKt.push(Math.round(150 + 330 * Math.min(climb, descent)));
    trackDeg.push(Math.round(heading));
  }

  return {
    coordinates,
    times,
    groundSpeedKt,
    trackDeg,
    sourceFormat: 'gpx' as const,
    sourceName: 'flight-log.gpx',
  };
};
