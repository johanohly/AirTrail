type Vector = readonly [number, number, number];
type Position = readonly [longitude: number, latitude: number];

const RADIANS = Math.PI / 180;
const COINCIDENT_ANGLE = 1e-12;
const ANTIPODAL_ANGLE = 1e-7;
export const EARTH_RADIUS_METERS = 6_371_008.8;

const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const toUnitVector = (longitude: number, latitude: number): Vector => {
  const lon = longitude * RADIANS;
  const lat = latitude * RADIANS;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
};

const angleBetween = (a: Vector, b: Vector) =>
  Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));

export const sphericalDistance = (a: Vector, b: Vector) =>
  angleBetween(a, b) * EARTH_RADIUS_METERS;

export const createGreatCircleArc = (start: Vector, end: Vector) => {
  const axis = cross(start, end);
  const axisLength = Math.hypot(...axis);
  const angle = Math.atan2(axisLength, dot(start, end));
  if (angle <= COINCIDENT_ANGLE || Math.PI - angle <= ANTIPODAL_ANGLE) {
    return {
      angle,
      kind:
        angle <= COINCIDENT_ANGLE
          ? ('coincident' as const)
          : ('antipodal' as const),
    };
  }

  const normal: Vector = [
    axis[0] / axisLength,
    axis[1] / axisLength,
    axis[2] / axisLength,
  ];
  const tangent = cross(normal, start);
  return { angle, kind: 'arc' as const, start, end, tangent, normal };
};

type Arc = Extract<ReturnType<typeof createGreatCircleArc>, { kind: 'arc' }>;

export const projectOntoArc = (arc: Arc, point: Vector) => {
  const along = Math.atan2(dot(point, arc.tangent), dot(point, arc.start));
  if (along >= 0 && along <= arc.angle) {
    const crossTrack = Math.atan2(
      Math.abs(dot(point, arc.normal)),
      Math.hypot(dot(point, arc.start), dot(point, arc.tangent)),
    );
    return {
      progress: along / arc.angle,
      distance: crossTrack * EARTH_RADIUS_METERS,
    };
  }

  const startDistance = sphericalDistance(arc.start, point);
  const endDistance = sphericalDistance(arc.end, point);
  return startDistance <= endDistance
    ? { progress: 0, distance: startDistance }
    : { progress: 1, distance: endDistance };
};

export const interpolateGreatCircleArc = (
  arc: Arc,
  progress: number,
): Position => {
  const angle = arc.angle * progress;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = arc.start[0] * cos + arc.tangent[0] * sin;
  const y = arc.start[1] * cos + arc.tangent[1] * sin;
  const z = arc.start[2] * cos + arc.tangent[2] * sin;
  return [
    Math.atan2(y, x) / RADIANS,
    Math.atan2(z, Math.hypot(x, y)) / RADIANS,
  ];
};
