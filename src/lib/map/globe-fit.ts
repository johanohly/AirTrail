import {
  sampleFitShape,
  smallestEnclosingCap,
  toLngLat,
  weightedFitCenter,
  type FitShape,
  type Vec3,
} from './fit-geometry';

export type GlobeFitViewport = {
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
};

type Frame = { center: Vec3; east: Vec3; north: Vec3 };

const DEGREES = Math.PI / 180;

// MapLibre's default vertical field of view (transform._fovInRadians); the
// camera sits at 0.5 * height / tan(fov / 2) pixels from the map center.
const FOV_TAN_HALF = Math.tan(0.6435011087932844 / 2);
// MapLibre clamps the latitude it scales the globe by (planetScaleAtLatitude).
const MAX_SCALE_LATITUDE = 85.051129;
// How far a drawn point may turn away from the camera: the angle between the
// surface normal under it and the direction to the camera. Past about 70° the
// globe foreshortens a coastline into a sliver, so routes near the limb show
// as little more than their labels.
export const MAX_LIMB_ANGLE = 70 * DEGREES;
// Recentering usually settles in a few steps; the cap is a safety net.
const RECENTER_STEPS = 16;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const frameAt = (center: Vec3): Frame => {
  // Bearing is locked to north, so screen right is local east. At a pole any
  // direction works.
  const eastLength = Math.hypot(center[0], center[1]);
  const east: Vec3 =
    eastLength < 1e-12
      ? [0, 1, 0]
      : [-center[1] / eastLength, center[0] / eastLength, 0];
  const north: Vec3 = [
    center[1] * east[2] - center[2] * east[1],
    center[2] * east[0] - center[0] * east[2],
    center[0] * east[1] - center[1] * east[0],
  ];
  return { center, east, north };
};

const SIN_LIMB = Math.sin(MAX_LIMB_ANGLE);
const COS_LIMB = Math.cos(MAX_LIMB_ANGLE);

/*
 * MapLibre's globe camera (VerticalPerspectiveTransform._calcMatrices) looks
 * straight down at the center from `focal` pixels above the surface, with the
 * padding shifting the principal point rather than the camera. A point at
 * unit vector p then lands at focal * R * (p·east, p·north) / (focal +
 * R * (1 - p·center)) pixels from the padded center, for a globe of radius R
 * pixels.
 *
 * A point θ from the center turns away from the camera by θ plus the angle
 * the camera sees between the center and the point, so its limb angle grows
 * with R. In the triangle of globe center, point and camera, the law of sines
 * gives (R + focal) · sin(limb - θ) = R · sin(limb), which bounds R. At 90°
 * this is the horizon.
 */
const largestGlobeRadius = (
  points: Vec3[],
  frame: Frame,
  halfWidth: number,
  halfHeight: number,
  focal: number,
  limited: boolean,
) => {
  let radius = Infinity;
  for (const point of points) {
    const up = dot(point, frame.center);
    if (up <= 0) return 0;
    const depth = 1 - up;
    if (depth > 0) {
      if (limited) {
        const sin = Math.sqrt(Math.max(0, 1 - up * up));
        // sin(limb - θ), positive while some zoom keeps the point within
        // the limb angle.
        const margin = SIN_LIMB * up - COS_LIMB * sin;
        if (margin <= 0) return 0;
        radius = Math.min(radius, (focal * margin) / (SIN_LIMB - margin));
      } else {
        radius = Math.min(radius, (focal * up) / depth);
      }
    }
    const x = Math.abs(dot(point, frame.east));
    const y = Math.abs(dot(point, frame.north));
    const xDenominator = focal * x - halfWidth * depth;
    if (xDenominator > 0) {
      radius = Math.min(radius, (halfWidth * focal) / xDenominator);
    }
    const yDenominator = focal * y - halfHeight * depth;
    if (yDenominator > 0) {
      radius = Math.min(radius, (halfHeight * focal) / yDenominator);
    }
  }
  return radius;
};

const screenExtent = (
  points: Vec3[],
  frame: Frame,
  radius: number,
  focal: number,
) => {
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  for (const point of points) {
    const scale =
      (focal * radius) / (focal + radius * (1 - dot(point, frame.center)));
    const x = dot(point, frame.east) * scale;
    const y = dot(point, frame.north) * scale;
    left = Math.min(left, x);
    right = Math.max(right, x);
    bottom = Math.min(bottom, y);
    top = Math.max(top, y);
  }
  return { x: (left + right) / 2, y: (bottom + top) / 2 };
};

// The surface point under a screen offset from the center, by casting the
// camera ray through it onto the sphere.
const surfaceAt = (
  frame: Frame,
  x: number,
  y: number,
  radius: number,
  focal: number,
): Vec3 | undefined => {
  const height = radius + focal;
  // Ray from (0, 0, height) along (x, y, -focal) in (east, north, center)
  // coordinates, scaled to a unit globe.
  const ox = 0;
  const oz = height / radius;
  const dx = x / radius;
  const dy = y / radius;
  const dz = -focal / radius;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = oz * oz - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  const e = dx * t;
  const n = dy * t;
  const u = oz + dz * t;
  return [
    frame.east[0] * e + frame.north[0] * n + frame.center[0] * u,
    frame.east[1] * e + frame.north[1] * n + frame.center[1] * u,
    frame.east[2] * e + frame.north[2] * n + frame.center[2] * u,
  ];
};

const toCamera = (center: Vec3, radius: number) => {
  const [lng, lat] = toLngLat(center);
  // MapLibre's getGlobeRadiusPixels: radius = worldSize / 2π / cos(lat),
  // with worldSize = 512 * 2^zoom.
  const scaleLatitude = Math.min(Math.abs(lat), MAX_SCALE_LATITUDE) * DEGREES;
  const zoom = Math.log2(
    (radius * 2 * Math.PI * Math.cos(scaleLatitude)) / 512,
  );
  return { center: [lng, lat] as [number, number], zoom };
};

/**
 * Camera (center + zoom) that shows every drawn airport, arc and track on
 * the MapLibre globe, as large as the padded viewport allows. It starts from
 * the smallest cap around the drawn geometry, sizes the globe so the
 * geometry's projected extent touches the padded rectangle, and then moves
 * the center until the margins on opposite sides match.
 *
 * No point may sit so close to the limb that it is foreshortened into a
 * sliver (MAX_LIMB_ANGLE). A set too wide for that gets the whole disc
 * around the same center instead. When not even the whole disc can show
 * everything (the routes span more than the visible hemisphere), it falls
 * back to a whole-planet view centered on the flight-weighted airport
 * centroid, so the side the user flies most faces the camera.
 *
 * The returned center is the raw view center: pass the same padding to
 * easeTo/flyTo (or set it persistently) so the camera places it at the
 * padded viewport center.
 */
export const globeCameraForShape = (
  shape: FitShape,
  viewport: GlobeFitViewport,
  maxZoom: number,
): { center: [number, number]; zoom: number } | undefined => {
  const points = sampleFitShape(shape);
  if (!points.length) return undefined;

  const { width, height, padding } = viewport;
  if (!(width > 0) || !(height > 0)) return undefined;
  // Degenerate viewports (padding exceeding the screen) still deserve a
  // sensible view rather than a dead control.
  const halfWidth = Math.max(width - padding.left - padding.right, 80) / 2;
  const halfHeight = Math.max(height - padding.top - padding.bottom, 80) / 2;
  const focal = (0.5 * height) / FOV_TAN_HALF;

  // Globe radius at which the whole disc, rim included, fits the padded
  // viewport. Any view showing every point that is zoomed out past this
  // would only shrink the planet.
  const halfExtent = Math.min(halfWidth, halfHeight);
  const wholeDiscRadius =
    (halfExtent * halfExtent + halfExtent * Math.hypot(halfExtent, focal)) /
    focal;

  const cap = smallestEnclosingCap(points);
  if (cap) {
    let frame = frameAt(cap.center);
    let radius = largestGlobeRadius(
      points,
      frame,
      halfWidth,
      halfHeight,
      focal,
      true,
    );
    for (
      let step = 0;
      step < RECENTER_STEPS && Number.isFinite(radius);
      step++
    ) {
      const offset = screenExtent(points, frame, radius, focal);
      if (Math.hypot(offset.x, offset.y) < 0.5) break;
      // The perspective makes a full step overshoot now and then; halve it
      // until the view grows.
      let moved = false;
      for (let fraction = 1; fraction >= 1 / 8 && !moved; fraction /= 2) {
        const center = surfaceAt(
          frame,
          offset.x * fraction,
          offset.y * fraction,
          radius,
          focal,
        );
        if (!center) continue;
        const nextFrame = frameAt(center);
        const nextRadius = largestGlobeRadius(
          points,
          nextFrame,
          halfWidth,
          halfHeight,
          focal,
          true,
        );
        if (nextRadius >= radius) {
          frame = nextFrame;
          radius = nextRadius;
          moved = true;
        }
      }
      if (!moved) break;
    }

    if (!Number.isFinite(radius)) {
      return { center: toLngLat(frame.center), zoom: maxZoom };
    }
    if (radius >= wholeDiscRadius) {
      const camera = toCamera(frame.center, radius);
      return { ...camera, zoom: Math.min(camera.zoom, maxZoom) };
    }
    // Too wide to keep clear of the limb at any zoom that still frames the
    // planet: show the whole disc around the same center, as long as every
    // point is at least in front of the horizon there.
    const visible = largestGlobeRadius(
      points,
      frame,
      halfWidth,
      halfHeight,
      focal,
      false,
    );
    if (visible >= wholeDiscRadius) {
      return toCamera(frame.center, wholeDiscRadius);
    }
  }

  const center = weightedFitCenter(shape) ?? cap?.center ?? points[0]!;
  return toCamera(center, wholeDiscRadius);
};
