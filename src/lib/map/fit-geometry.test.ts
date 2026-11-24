import { describe, expect, it } from 'vitest';

import {
  fitShapeBounds,
  sampleFitShape,
  smallestEnclosingCap,
  toLngLat,
  type FitRoute,
  type FitShape,
  type Vec3,
} from './fit-geometry';
import {
  globeCameraForShape,
  MAX_LIMB_ANGLE,
  type GlobeFitViewport,
} from './globe-fit';

import type { Airport } from '$lib/db/types';
import { toUnitVector } from '$lib/track/great-circle';

const AIRPORTS = {
  CPH: [12.6561, 55.6179],
  LHR: [-0.4614, 51.4775],
  AMS: [4.7639, 52.3086],
  FRA: [8.5706, 50.0333],
  MUC: [11.7861, 48.3538],
  VIE: [16.5697, 48.1103],
  ARN: [17.9186, 59.6519],
  HEL: [24.9633, 60.3172],
  OSL: [11.1004, 60.1939],
  BCN: [2.0785, 41.2971],
  LIS: [-9.1342, 38.7813],
  KEF: [-22.6056, 63.985],
  CAI: [31.4056, 30.1219],
  MSP: [-93.2218, 44.882],
  ORD: [-87.9048, 41.9786],
  IAD: [-77.4558, 38.9445],
  EWR: [-74.1687, 40.6925],
  SFO: [-122.375, 37.619],
  LAX: [-118.408, 33.9425],
  SEA: [-122.309, 47.449],
  NRT: [140.386, 35.7647],
  HND: [139.781, 35.5523],
  HKG: [113.915, 22.3089],
  SYD: [151.177, -33.9461],
  SIN: [103.994, 1.3502],
  JNB: [28.246, -26.1392],
  GRU: [-46.4731, -23.4356],
  JFK: [-73.7781, 40.6398],
} as const;

type Code = keyof typeof AIRPORTS;

const airport = (code: Code) => {
  const [lon, lat] = AIRPORTS[code];
  return {
    id: Object.keys(AIRPORTS).indexOf(code) + 1,
    lon,
    lat,
  } as Airport;
};

const route = (from: Code, to: Code, frequency = 1): FitRoute => ({
  from: airport(from),
  to: airport(to),
  frequency,
});

const shape = (
  arcs: FitRoute[],
  tracks: FitShape['tracks'] = [],
): FitShape => ({ arcs, tracks });

// A recorded CPH -> MSP crossing that routes over Greenland, well north of
// the great circle between the two airports.
const greenlandTrack = {
  route: route('CPH', 'MSP'),
  path: [
    [12.6561, 55.6179],
    [-10, 64],
    [-40, 71],
    [-75, 64],
    [-93.2218, 44.882],
  ],
};

// Johan's map: a Copenhagen hub with many European spokes, Reykjavik, the US
// east coast and Midwest, and Cairo.
const hubShape = shape(
  [
    ...(['LHR', 'AMS', 'FRA', 'MUC', 'VIE', 'ARN', 'HEL', 'OSL'] as const).map(
      (to) => route('CPH', to, 6),
    ),
    route('CPH', 'BCN'),
    route('CPH', 'LIS'),
    route('CPH', 'KEF'),
    route('CPH', 'CAI'),
    route('CPH', 'ORD'),
    route('CPH', 'IAD'),
    route('CPH', 'EWR'),
  ],
  [greenlandTrack],
);

const europeShape = shape(
  (['ARN', 'OSL', 'HEL', 'LHR', 'AMS', 'FRA', 'MUC'] as const).map((to) =>
    route('CPH', to),
  ),
);

const pacificShape = shape([
  route('SFO', 'HND', 3),
  route('LAX', 'NRT'),
  route('SFO', 'HKG'),
  route('LAX', 'SYD'),
  route('HND', 'HKG'),
]);

const globalShape = shape([
  route('CPH', 'SIN'),
  route('CPH', 'JFK', 4),
  route('JFK', 'LAX', 2),
  route('LAX', 'SYD'),
  route('SYD', 'SIN'),
  route('CPH', 'JNB'),
  route('JFK', 'GRU'),
  route('CPH', 'LHR', 6),
]);

const DEGREES = Math.PI / 180;
const FOV = 0.6435011087932844;

/*
 * Where MapLibre's globe camera puts a location, written as a camera ray
 * (camera `focal` pixels above the view center, looking straight down, north
 * up) rather than the closed form the fit solves.
 */
const projectOnGlobe = (
  camera: { center: [number, number]; zoom: number },
  viewport: GlobeFitViewport,
  point: Vec3,
) => {
  const [lng, lat] = camera.center;
  const radius =
    (512 * 2 ** camera.zoom) / (2 * Math.PI) / Math.cos(lat * DEGREES);
  const focal = (0.5 * viewport.height) / Math.tan(FOV / 2);
  const up = toUnitVector(lng, lat);
  const east = [-Math.sin(lng * DEGREES), Math.cos(lng * DEGREES), 0];
  const north = [
    up[1] * east[2]! - up[2] * east[1]!,
    up[2] * east[0]! - up[0] * east[2]!,
    up[0] * east[1]! - up[1] * east[0]!,
  ];
  const relative = point.map(
    (value, i) => value * radius - up[i]! * (radius + focal),
  );
  const along = (axis: readonly number[]) =>
    relative[0]! * axis[0]! + relative[1]! * axis[1]! + relative[2]! * axis[2]!;
  const depth = -along(up);
  const { padding, width, height } = viewport;
  const visible =
    point[0] * up[0] + point[1] * up[1] + point[2] * up[2] >
    radius / (radius + focal);
  return {
    visible,
    x:
      (padding.left + width - padding.right) / 2 +
      (focal * along(east)) / depth,
    y:
      (padding.top + height - padding.bottom) / 2 -
      (focal * along(north)) / depth,
  };
};

const globeRadius = (camera: { center: [number, number]; zoom: number }) =>
  (512 * 2 ** camera.zoom) /
  (2 * Math.PI) /
  Math.cos(camera.center[1] * DEGREES);

// The globe radius at which the whole disc, rim included, fills the shorter
// padded side.
const wholeDiscRadius = (view: GlobeFitViewport) => {
  const half =
    Math.min(
      view.width - view.padding.left - view.padding.right,
      view.height - view.padding.top - view.padding.bottom,
    ) / 2;
  const focal = (0.5 * view.height) / Math.tan(FOV / 2);
  return (half * half + half * Math.hypot(half, focal)) / focal;
};

const marginsOnGlobe = (
  fitShape: FitShape,
  viewport: GlobeFitViewport,
  camera: { center: [number, number]; zoom: number },
) => {
  let left = Infinity;
  let right = Infinity;
  let top = Infinity;
  let bottom = Infinity;
  let hidden = 0;
  let limb = 0;
  const center = toUnitVector(...camera.center);
  const radius = globeRadius(camera);
  const focal = (0.5 * viewport.height) / Math.tan(FOV / 2);
  for (const point of sampleFitShape(fitShape)) {
    const projected = projectOnGlobe(camera, viewport, point);
    if (!projected.visible) hidden++;
    // The angle between the surface normal and the direction to the camera.
    const toCamera = center.map(
      (value, i) => value * (radius + focal) - point[i]! * radius,
    );
    limb = Math.max(
      limb,
      Math.acos(
        (point[0] * toCamera[0]! +
          point[1] * toCamera[1]! +
          point[2] * toCamera[2]!) /
          Math.hypot(...toCamera),
      ),
    );
    left = Math.min(left, projected.x);
    right = Math.min(right, viewport.width - projected.x);
    top = Math.min(top, projected.y);
    bottom = Math.min(bottom, viewport.height - projected.y);
  }
  return { left, right, top, bottom, hidden, limb };
};

const viewport = (width: number, height: number, inset = 60) => ({
  width,
  height,
  padding: { top: inset, right: inset, bottom: inset, left: inset },
});

const angleBetween = (a: Vec3, b: Vec3) =>
  Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

describe('fit geometry', () => {
  it('samples the poleward bulge of a great-circle arc', () => {
    const north = Math.max(
      ...sampleFitShape(shape([route('CPH', 'MSP')])).map(
        (point) => toLngLat(point)[1],
      ),
    );

    // The great circle peaks far north of both airports.
    expect(north).toBeGreaterThan(62);
  });

  it('thins dense tracks but keeps their far ends', () => {
    const path = Array.from({ length: 5_000 }, (_, index) => [
      12.6561 - (index * 105.8779) / 4_999,
      55.6179 + Math.sin((index / 4_999) * Math.PI) * 15,
    ]);
    const points = sampleFitShape(
      shape([], [{ route: route('CPH', 'MSP'), path }]),
    );
    const north = Math.max(...points.map((point) => toLngLat(point)[1]));

    expect(points.length).toBeLessThan(1_000);
    expect(north).toBeGreaterThan(55.6179 + 14.9);
  });

  it('bounds the drawn tracks and arcs, not only the airports', () => {
    const [[, south], [, north]] = fitShapeBounds(hubShape)!;

    expect(north).toBeCloseTo(71, 1);
    expect(south).toBeCloseTo(AIRPORTS.CAI[1], 3);
  });

  it('bounds a set crossing the antimeridian east of 180°', () => {
    const [[west], [east]] = fitShapeBounds(shape([route('NRT', 'SFO')]))!;

    expect(west).toBeCloseTo(AIRPORTS.NRT[0], 3);
    expect(east).toBeCloseTo(AIRPORTS.SFO[0] + 360, 3);
  });

  it('spans the whole world when the drawn routes circle it', () => {
    const [[west], [east]] = fitShapeBounds(globalShape)!;

    // Centered on the busy Copenhagen-London-New York side, so the seam at
    // the edges runs through the Pacific.
    expect(east - west).toBe(360);
    expect((west + east) / 2).toBeGreaterThan(-60);
    expect((west + east) / 2).toBeLessThan(20);
  });

  it('does not count sparse samples on a long arc as a gap', () => {
    // A high-latitude arc covers more longitude per sample than the low
    // ones, but the line still covers every degree between them.
    const [[west], [east]] = fitShapeBounds(
      shape([route('CPH', 'JFK'), route('JFK', 'SFO'), route('SFO', 'NRT')]),
    )!;

    expect(west).toBeCloseTo(AIRPORTS.NRT[0], 3);
    expect(east).toBeCloseTo(AIRPORTS.CPH[0] + 360, 3);
  });

  it('bounds a single airport as a point', () => {
    const [[west, south], [east, north]] = fitShapeBounds(
      shape([route('CPH', 'CPH')]),
    )!;

    expect(west).toBeCloseTo(AIRPORTS.CPH[0], 9);
    expect(east).toBeCloseTo(AIRPORTS.CPH[0], 9);
    expect(south).toBeCloseTo(AIRPORTS.CPH[1], 9);
    expect(north).toBeCloseTo(AIRPORTS.CPH[1], 9);
  });

  it('centers the enclosing cap on the extremes, not on the hub', () => {
    const points = sampleFitShape(hubShape);
    const cap = smallestEnclosingCap(points)!;

    for (const point of points) {
      expect(angleBetween(cap.center, point)).toBeLessThanOrEqual(
        cap.radius + 1e-9,
      );
    }
    // Minneapolis and Cairo are the two far ends; the cap is barely wider
    // than half the distance between them.
    const span = angleBetween(
      toUnitVector(...AIRPORTS.MSP),
      toUnitVector(...AIRPORTS.CAI),
    );
    expect(cap.radius).toBeLessThan(span / 2 + 2 * DEGREES);
  });

  it('finds no cap for points that surround the globe', () => {
    const points: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    expect(smallestEnclosingCap(points)).toBeUndefined();
  });
});

describe('globe camera', () => {
  const expectInsidePadding = (margins: ReturnType<typeof marginsOnGlobe>) => {
    expect(margins.hidden).toBe(0);
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      expect(margins[side]).toBeGreaterThanOrEqual(59);
    }
  };

  it.each([
    ['a hub-heavy transatlantic set', hubShape, viewport(1300, 1200)],
    ['a European cluster', europeShape, viewport(1300, 1200)],
    ['a European cluster on a phone', europeShape, viewport(390, 844)],
  ] as const)('fits %s tightly with balanced margins', (_, fitShape, view) => {
    const camera = globeCameraForShape(fitShape, view, 12)!;
    const margins = marginsOnGlobe(fitShape, view, camera);

    expectInsidePadding(margins);
    expect(margins.limb).toBeLessThanOrEqual(MAX_LIMB_ANGLE);
    // At least one pair of opposite sides touches the padding, and the
    // pair is balanced.
    const horizontal = Math.abs(margins.left - margins.right);
    const vertical = Math.abs(margins.top - margins.bottom);
    const tight =
      (Math.min(margins.left, margins.right) < 62 && horizontal < 3) ||
      (Math.min(margins.top, margins.bottom) < 62 && vertical < 3);
    expect(tight).toBe(true);
  });

  it.each([
    ['a hub-heavy set in a wide window', hubShape, viewport(2000, 830)],
    ['a trans-Pacific set on a phone', pacificShape, viewport(390, 844)],
  ] as const)(
    'stops zooming before %s reaches the limb',
    (_, fitShape, view) => {
      const camera = globeCameraForShape(fitShape, view, 12)!;
      const margins = marginsOnGlobe(fitShape, view, camera);

      expectInsidePadding(margins);
      // The limb, not the padding, is what limits the zoom here.
      expect(margins.limb).toBeLessThanOrEqual(MAX_LIMB_ANGLE + 1e-9);
      expect(margins.limb).toBeGreaterThan(MAX_LIMB_ANGLE - 0.5 * DEGREES);
    },
  );

  it('shows the whole disc around a trans-Pacific set too wide for the limb', () => {
    const view = viewport(1300, 1200);
    const camera = globeCameraForShape(pacificShape, view, 12)!;
    const margins = marginsOnGlobe(pacificShape, view, camera);

    // San Francisco is 58.6° from the center of the smallest cap, so no view
    // that still frames the planet keeps it within the limb angle. The camera
    // zooms out to the whole disc around that cap rather than hugging the
    // limb, which leaves the coast at about 75° instead of almost 90°.
    expectInsidePadding(margins);
    expect(globeRadius(camera)).toBeCloseTo(wholeDiscRadius(view), 3);
    expect(camera.center[0]).toBeCloseTo(177, 0);
    expect(camera.center[1]).toBeCloseTo(19.3, 0);
    expect(margins.limb).toBeLessThan(76 * DEGREES);
  });

  it('keeps a trans-Pacific set centered across the antimeridian', () => {
    const camera = globeCameraForShape(pacificShape, viewport(1300, 1200), 12)!;

    expect(Math.abs(Math.abs(camera.center[0]) - 180)).toBeLessThan(30);
  });

  it('zooms a single airport to the closest fit', () => {
    const camera = globeCameraForShape(
      shape([route('CPH', 'CPH')]),
      viewport(1300, 1200),
      12,
    )!;

    expect(camera.zoom).toBe(12);
    expect(camera.center[0]).toBeCloseTo(AIRPORTS.CPH[0], 6);
    expect(camera.center[1]).toBeCloseTo(AIRPORTS.CPH[1], 6);
  });

  it('turns a near-global set toward where the user flies most', () => {
    const view = viewport(1300, 1200);
    const camera = globeCameraForShape(globalShape, view, 12)!;

    // No single view can hold these routes, so the whole planet is shown,
    // with the busy Copenhagen-London-New York side facing the camera.
    const margins = marginsOnGlobe(globalShape, view, camera);
    expect(margins.hidden).toBeGreaterThan(0);
    expect(camera.center[0]).toBeGreaterThan(-60);
    expect(camera.center[0]).toBeLessThan(20);
    expect(camera.center[1]).toBeGreaterThan(30);
    expect(globeRadius(camera)).toBeCloseTo(wholeDiscRadius(view), 3);
  });
});
