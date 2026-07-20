import { geoCircle } from 'd3-geo';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';

export const TIME_OF_DAY_SOURCE_ID = 'airtrail-time-of-day-source';
export const TIME_OF_DAY_LAYER_ID_PREFIX = 'airtrail-time-of-day';
export const TIME_OF_DAY_LAYER_ID = `${TIME_OF_DAY_LAYER_ID_PREFIX}-night`;

export type TimeOfDayProjection = 'mercator' | 'globe';
export type TimeOfDaySeverity = 'civil' | 'nautical' | 'astronomical' | 'night';

export type TimeOfDayFeature = Feature<
  Polygon | MultiPolygon,
  {
    severity: TimeOfDaySeverity;
  }
>;

export type TimeOfDayFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  TimeOfDayFeature['properties']
>;

type Coordinate = [number, number];
type Ring = Coordinate[];

export const TIME_OF_DAY_SEVERITIES: Array<{
  severity: TimeOfDaySeverity;
  altitudeMax: number;
  lightOpacity: number;
  darkOpacity: number;
}> = [
  { severity: 'civil', altitudeMax: 0, lightOpacity: 0.1, darkOpacity: 0.035 },
  {
    severity: 'nautical',
    altitudeMax: -6,
    lightOpacity: 0.085,
    darkOpacity: 0.025,
  },
  {
    severity: 'astronomical',
    altitudeMax: -12,
    lightOpacity: 0.075,
    darkOpacity: 0.02,
  },
  {
    severity: 'night',
    altitudeMax: -18,
    lightOpacity: 0.07,
    darkOpacity: 0.02,
  },
];

const DAY_IN_MS = 86_400_000;
const J2000 = 2_451_545;
const JD1970 = 2_440_588;
const CIRCLE_PRECISION_DEGREES = 0.5;
const POLE_EDGE_LATITUDE = 89.999;

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

const normalizeDegrees = (degrees: number) => {
  const normalized = ((degrees + 180) % 360) - 180;
  return normalized < -180 ? normalized + 360 : normalized;
};

const getSolarPosition = (date: Date) => {
  const julianDay = date.getTime() / DAY_IN_MS - 0.5 + JD1970;
  const days = julianDay - J2000;
  const meanLongitude = normalizeDegrees(280.459 + 0.98564736 * days);
  const meanAnomaly = degreesToRadians(
    normalizeDegrees(357.529 + 0.98560028 * days),
  );
  const eclipticLongitude = degreesToRadians(
    normalizeDegrees(
      meanLongitude +
        1.915 * Math.sin(meanAnomaly) +
        0.02 * Math.sin(2 * meanAnomaly),
    ),
  );
  const obliquity = degreesToRadians(23.439 - 0.00000036 * days);
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const greenwichSiderealTime =
    ((18.697374558 + 24.06570982441908 * days) % 24) * 15;
  const subsolarLongitude = normalizeDegrees(
    radiansToDegrees(rightAscension) - greenwichSiderealTime,
  );

  return {
    subsolarLatitude: radiansToDegrees(declination),
    subsolarLongitude,
  };
};

const createFeature = (
  severity: TimeOfDaySeverity,
  geometry: Polygon | MultiPolygon,
): TimeOfDayFeature => ({
  type: 'Feature',
  properties: { severity },
  geometry,
});

const closeRing = (ring: Ring): Ring => {
  const first = ring[0];

  if (!first) {
    return ring;
  }

  const last = ring.at(-1);

  if (last && last[0] === first[0] && last[1] === first[1]) {
    return ring;
  }

  return [...ring, first];
};

const findDatelineJumpIndex = (ring: Ring) =>
  ring.findIndex((coordinate, index) => {
    const next = ring[(index + 1) % ring.length];

    if (!next) {
      return false;
    }

    return Math.abs(next[0] - coordinate[0]) > 180;
  });

const findDatelineJumpIndexes = (ring: Ring): [number, number] | null => {
  const jumpIndexes: number[] = [];

  ring.forEach((coordinate, index) => {
    const next = ring[index + 1];

    if (!next) {
      return;
    }

    if (Math.abs(next[0] - coordinate[0]) > 180) {
      jumpIndexes.push(index);
    }
  });

  const [first, second] = jumpIndexes;
  return first === undefined || second === undefined || jumpIndexes.length !== 2
    ? null
    : [first, second];
};

const getCoordinate = (ring: Ring, index: number): Coordinate => {
  const coordinate = ring[index];
  if (!coordinate) {
    throw new Error(`Missing coordinate at ring index ${index}`);
  }

  return coordinate;
};

const interpolateDatelineCrossing = (start: Coordinate, end: Coordinate) => {
  const endLongitude = start[0] > 0 && end[0] < 0 ? end[0] + 360 : end[0] - 360;
  const crossingLongitude = start[0] > 0 ? 180 : -180;
  const progress = (crossingLongitude - start[0]) / (endLongitude - start[0]);
  const latitude = start[1] + (end[1] - start[1]) * progress;

  return {
    east: [180, latitude] satisfies Coordinate,
    west: [-180, latitude] satisfies Coordinate,
  };
};

const createCircleRing = (center: Coordinate, radius: number): Ring => {
  const geometry = geoCircle()
    .center(center)
    .radius(radius)
    .precision(CIRCLE_PRECISION_DEGREES)() as Polygon;
  const ring = geometry.coordinates[0];
  if (!ring) {
    throw new Error('Generated solar circle has no coordinates');
  }

  return ring.map((position) => {
    const [longitude, latitude] = position;
    if (longitude === undefined || latitude === undefined) {
      throw new Error('Generated solar circle contains an invalid coordinate');
    }

    return [longitude, latitude];
  });
};

const createPolarCapPolygon = (
  ring: Ring,
  pole: 'north' | 'south',
): Polygon => {
  const jumpIndex = findDatelineJumpIndex(ring);

  if (jumpIndex === -1) {
    return { type: 'Polygon', coordinates: [ring] };
  }

  const start = getCoordinate(ring, jumpIndex);
  const end = getCoordinate(ring, (jumpIndex + 1) % ring.length);
  const crossing = interpolateDatelineCrossing(start, end);
  const ringWithoutClosingPoint = ring.slice(0, -1);
  const boundary = [
    ...ringWithoutClosingPoint.slice(jumpIndex + 1),
    ...ringWithoutClosingPoint.slice(0, jumpIndex + 1),
  ];
  const boundaryWestToEast =
    start[0] > 0
      ? [crossing.west, ...boundary, crossing.east]
      : [crossing.west, ...boundary.toReversed(), crossing.east];
  const poleLatitude =
    pole === 'north' ? POLE_EDGE_LATITUDE : -POLE_EDGE_LATITUDE;
  const poleEdge = [180, 120, 60, 0, -60, -120, -180].map(
    (longitude) => [longitude, poleLatitude] satisfies Coordinate,
  );
  const closedRing = [...boundaryWestToEast, ...poleEdge];

  return {
    type: 'Polygon',
    coordinates: [closeRing(closedRing)],
  };
};

const createAntimeridianSplitPolygon = (ring: Ring): MultiPolygon | null => {
  const jumpIndexes = findDatelineJumpIndexes(ring);

  if (!jumpIndexes) {
    return null;
  }

  const ringWithoutClosingPoint = ring.slice(0, -1);
  const [firstJumpIndex, secondJumpIndex] = jumpIndexes;
  const firstJumpNextIndex =
    (firstJumpIndex + 1) % ringWithoutClosingPoint.length;
  const secondJumpNextIndex =
    (secondJumpIndex + 1) % ringWithoutClosingPoint.length;
  const firstJump = getCoordinate(ringWithoutClosingPoint, firstJumpIndex);
  const firstJumpNext = getCoordinate(
    ringWithoutClosingPoint,
    firstJumpNextIndex,
  );
  const secondJump = getCoordinate(ringWithoutClosingPoint, secondJumpIndex);
  const secondJumpNext = getCoordinate(
    ringWithoutClosingPoint,
    secondJumpNextIndex,
  );
  const firstCrossing = interpolateDatelineCrossing(firstJump, firstJumpNext);
  const secondCrossing = interpolateDatelineCrossing(
    secondJump,
    secondJumpNext,
  );
  const firstJumpIsEastToWest = firstJump[0] > 0 && firstJumpNext[0] < 0;
  const eastRing = firstJumpIsEastToWest
    ? closeRing([
        secondCrossing.east,
        ...ringWithoutClosingPoint.slice(secondJumpIndex + 1),
        ...ringWithoutClosingPoint.slice(0, firstJumpIndex + 1),
        firstCrossing.east,
      ])
    : closeRing([
        firstCrossing.east,
        ...ringWithoutClosingPoint.slice(
          firstJumpIndex + 1,
          secondJumpIndex + 1,
        ),
        secondCrossing.east,
      ]);
  const westRing = firstJumpIsEastToWest
    ? closeRing([
        firstCrossing.west,
        ...ringWithoutClosingPoint.slice(
          firstJumpIndex + 1,
          secondJumpIndex + 1,
        ),
        secondCrossing.west,
      ])
    : closeRing([
        secondCrossing.west,
        ...ringWithoutClosingPoint.slice(secondJumpIndex + 1),
        ...ringWithoutClosingPoint.slice(0, firstJumpIndex + 1),
        firstCrossing.west,
      ]);

  return {
    type: 'MultiPolygon',
    coordinates: [[eastRing], [westRing]],
  };
};

const createCirclePolygon = (
  center: Coordinate,
  radius: number,
): Polygon | MultiPolygon => {
  const ring = createCircleRing(center, radius);
  const distanceToNorthPole = 90 - center[1];
  const distanceToSouthPole = 90 + center[1];

  if (distanceToNorthPole <= radius) {
    return createPolarCapPolygon(ring, 'north');
  }

  if (distanceToSouthPole <= radius) {
    return createPolarCapPolygon(ring, 'south');
  }

  const splitGeometry = createAntimeridianSplitPolygon(ring);

  if (splitGeometry) {
    return splitGeometry;
  }

  return { type: 'Polygon', coordinates: [closeRing(ring)] };
};

export const createTimeOfDayGeoJson = (
  date = new Date(),
  _projection: TimeOfDayProjection = 'mercator',
): TimeOfDayFeatureCollection => {
  const { subsolarLatitude, subsolarLongitude } = getSolarPosition(date);
  const antiSolarCenter: Coordinate = [
    normalizeDegrees(subsolarLongitude + 180),
    -subsolarLatitude,
  ];

  return {
    type: 'FeatureCollection',
    features: TIME_OF_DAY_SEVERITIES.map((item) =>
      createFeature(
        item.severity,
        createCirclePolygon(antiSolarCenter, 90 + item.altitudeMax),
      ),
    ),
  };
};
