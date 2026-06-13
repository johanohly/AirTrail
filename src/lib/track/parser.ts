import { gpx, kml } from '@tmcw/togeojson';

import {
  type FlightTrackCoordinate,
  type FlightTrackInput,
  type FlightTrackPayload,
  type FlightTrackSourceFormat,
  MAX_FLIGHT_TRACK_POINTS,
} from './schema';

import { parseCsvLine, sanitizeHeader } from '$lib/utils/csv';

const SIMPLIFY_THRESHOLD = 2_000;
const SIMPLIFY_TOLERANCE_METERS = 10;
const METERS_PER_DEGREE = 111_320;

export type ParsedTrackFile = FlightTrackInput & {
  originalPointCount: number;
};

type RawTrack = {
  coordinates: FlightTrackCoordinate[];
  times?: number[];
  groundSpeedKt?: number[];
  trackDeg?: number[];
};

type GeoJsonFeature = {
  geometry?: GeoJsonGeometry | null;
  properties?: {
    coordinateProperties?: {
      times?: unknown;
    };
  } | null;
};

type GeoJsonGeometry =
  | { type: 'LineString'; coordinates: unknown[] }
  | { type: 'MultiLineString'; coordinates: unknown[][] }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] }
  | { type: string };

export const parseTrackFile = async (file: File): Promise<ParsedTrackFile> => {
  const sourceFormat = detectTrackSourceFormat(file.name);
  if (!sourceFormat) {
    throw new Error('Unsupported track file type');
  }

  const content = await file.text();
  return parseTrackContent(content, sourceFormat, file.name);
};

export const parseTrackContent = (
  content: string,
  sourceFormat: FlightTrackSourceFormat,
  sourceName?: string,
): ParsedTrackFile => {
  const raw =
    sourceFormat === 'csv'
      ? parseCsvTrack(content)
      : parseXmlTrack(content, sourceFormat);

  if (raw.coordinates.length < 2) {
    throw new Error('Track must contain at least two points');
  }

  const originalPointCount = raw.coordinates.length;
  const simplifiedTrack =
    raw.coordinates.length > SIMPLIFY_THRESHOLD
      ? simplifyTrack(raw, SIMPLIFY_TOLERANCE_METERS)
      : raw;
  const track =
    simplifiedTrack.coordinates.length > MAX_FLIGHT_TRACK_POINTS
      ? limitTrackPoints(simplifiedTrack, MAX_FLIGHT_TRACK_POINTS)
      : simplifiedTrack;

  return {
    ...track,
    sourceFormat,
    sourceName: sourceName ?? null,
    originalPointCount,
  };
};

const detectTrackSourceFormat = (
  name: string,
): FlightTrackSourceFormat | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.gpx')) return 'gpx';
  if (lower.endsWith('.kml')) return 'kml';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
};

const parseXmlTrack = (
  content: string,
  sourceFormat: Exclude<FlightTrackSourceFormat, 'csv'>,
): RawTrack => {
  if (typeof DOMParser === 'undefined') {
    throw new TypeError(
      'Track XML parsing is not available in this environment',
    );
  }

  const document = new DOMParser().parseFromString(content, 'application/xml');
  const pointTrack = extractTimestampedPointTrack(document);
  if (pointTrack && pointTrack.coordinates.length >= 2) {
    return pointTrack;
  }

  const featureCollection =
    sourceFormat === 'gpx' ? gpx(document) : kml(document);

  const candidates = featureCollection.features
    .flatMap((feature) => extractFeatureTracks(feature as GeoJsonFeature))
    .filter((track) => track.coordinates.length >= 2);

  const longest = candidates.sort(
    (a, b) => b.coordinates.length - a.coordinates.length,
  )[0];
  if (!longest) {
    throw new Error('No track line found in file');
  }

  return longest;
};

const extractFeatureTracks = (feature: GeoJsonFeature): RawTrack[] => {
  if (!feature.geometry) return [];
  return extractGeometryTracks(
    feature.geometry,
    feature.properties?.coordinateProperties?.times,
  );
};

const extractGeometryTracks = (
  geometry: GeoJsonGeometry,
  times: unknown,
): RawTrack[] => {
  if (geometry.type === 'LineString') {
    const line = geometry as { type: 'LineString'; coordinates: unknown[] };
    return [
      buildRawTrack(
        line.coordinates,
        Array.isArray(times) && !Array.isArray(times[0]) ? times : undefined,
      ),
    ];
  }

  if (geometry.type === 'MultiLineString') {
    const multiLine = geometry as {
      type: 'MultiLineString';
      coordinates: unknown[][];
    };
    return [
      buildRawTrack(
        multiLine.coordinates.flat(),
        Array.isArray(times) ? times.flat() : undefined,
      ),
    ];
  }

  if (geometry.type === 'GeometryCollection') {
    const collection = geometry as {
      type: 'GeometryCollection';
      geometries: GeoJsonGeometry[];
    };
    return collection.geometries.flatMap((child: GeoJsonGeometry) =>
      extractGeometryTracks(child, times),
    );
  }

  return [];
};

const buildRawTrack = (coordinates: unknown[], times?: unknown[]): RawTrack => {
  const shouldNormalizeTimes = times?.length === coordinates.length;
  const normalizedCoordinates: FlightTrackCoordinate[] = [];
  const normalizedTimes: number[] = [];

  coordinates.forEach((rawCoordinate, index) => {
    const coordinate = normalizeCoordinate(rawCoordinate);
    if (!coordinate) return;

    normalizedCoordinates.push(coordinate);
    if (shouldNormalizeTimes) {
      const time = toEpochSeconds(times[index]);
      if (time !== null) normalizedTimes.push(time);
    }
  });

  return {
    coordinates: normalizedCoordinates,
    times:
      shouldNormalizeTimes &&
      normalizedTimes.length === normalizedCoordinates.length
        ? normalizedTimes
        : undefined,
  };
};

const extractTimestampedPointTrack = (document: Document): RawTrack | null => {
  const coordinates: FlightTrackCoordinate[] = [];
  const times: number[] = [];
  const groundSpeedKt: number[] = [];
  const trackDeg: number[] = [];

  for (const placemark of Array.from(
    document.getElementsByTagName('Placemark'),
  )) {
    const coordinateText = placemark
      .getElementsByTagName('Point')[0]
      ?.getElementsByTagName('coordinates')[0]
      ?.textContent?.trim();
    const time = toEpochSeconds(
      placemark.getElementsByTagName('when')[0]?.textContent,
    );
    if (!coordinateText || time === null) continue;

    const coordinate = normalizeCoordinate(parseKmlCoordinate(coordinateText));
    if (!coordinate) continue;

    coordinates.push(coordinate);
    times.push(time);

    const description = placemark
      .getElementsByTagName('description')[0]
      ?.textContent?.trim();
    const speed = parseDescriptionNumber(description, 'Speed', 'kt');
    if (speed !== null) groundSpeedKt.push(speed);

    const heading =
      parseNumber(
        placemark.getElementsByTagName('heading')[0]?.textContent ?? undefined,
      ) ?? parseDescriptionNumber(description, 'Heading');
    if (heading !== null) trackDeg.push(normalizeTrackDegrees(heading));
  }

  if (coordinates.length < 2) return null;

  return {
    coordinates,
    times: times.length === coordinates.length ? times : undefined,
    groundSpeedKt:
      groundSpeedKt.length === coordinates.length ? groundSpeedKt : undefined,
    trackDeg: trackDeg.length === coordinates.length ? trackDeg : undefined,
  };
};

const parseKmlCoordinate = (value: string) => {
  return value.split(',').map((part) => part.trim());
};

const normalizeCoordinate = (input: unknown): FlightTrackCoordinate | null => {
  if (!Array.isArray(input) || input.length < 2) return null;
  const lon = Number(input[0]);
  const lat = Number(input[1]);
  const alt = input[2] === undefined ? undefined : Number(input[2]);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (alt !== undefined && !Number.isFinite(alt)) return [lon, lat];
  return alt === undefined ? [lon, lat] : [lon, lat, alt];
};

const parseCsvTrack = (content: string): RawTrack => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines.shift();
  if (!headerLine) {
    throw new Error('CSV track file is empty');
  }

  const headers = parseCsvLine(headerLine).map(sanitizeHeader);
  const latitudeHeader = findHeader(headers, [
    'latitude',
    'lat',
    'position_latitude',
  ]);
  const longitudeHeader = findHeader(headers, [
    'longitude',
    'lon',
    'lng',
    'position_longitude',
  ]);
  const altitudeHeader = findHeader(headers, [
    'altitude',
    'alt',
    'altitude_ft',
    'altitude_feet',
  ]);
  const timeHeader = findHeader(headers, [
    'utc',
    'date_utc',
    'timestamp',
    'time',
    'date_time',
    'datetime',
  ]);
  const positionHeader = findHeader(headers, ['position', 'coordinates']);
  const speedHeader = findHeader(headers, [
    'speed',
    'ground_speed',
    'groundspeed',
    'ground_speed_kt',
    'speed_kt',
  ]);
  const trackHeader = findHeader(headers, [
    'direction',
    'heading',
    'track',
    'course',
    'track_deg',
    'heading_deg',
  ]);

  if ((!latitudeHeader || !longitudeHeader) && !positionHeader) {
    throw new Error('CSV track file needs latitude and longitude columns');
  }

  const coordinates: FlightTrackCoordinate[] = [];
  const times: number[] = [];
  const groundSpeedKt: number[] = [];
  const trackDeg: number[] = [];

  for (const line of lines) {
    const parsedRow = parseCsvTrackRow(line, {
      headers,
      latitudeHeader,
      longitudeHeader,
      positionHeader,
      altitudeHeader,
      timeHeader,
      speedHeader,
      trackHeader,
    });
    if (!parsedRow) continue;

    coordinates.push(parsedRow.coordinate);
    if (parsedRow.time !== null) times.push(parsedRow.time);
    if (parsedRow.groundSpeedKt !== null) {
      groundSpeedKt.push(parsedRow.groundSpeedKt);
    }
    if (parsedRow.trackDeg !== null) trackDeg.push(parsedRow.trackDeg);
  }

  return {
    coordinates,
    times: times.length === coordinates.length ? times : undefined,
    groundSpeedKt:
      groundSpeedKt.length === coordinates.length ? groundSpeedKt : undefined,
    trackDeg: trackDeg.length === coordinates.length ? trackDeg : undefined,
  };
};

const parseCsvTrackRow = (
  line: string,
  columns: {
    headers: string[];
    latitudeHeader?: string;
    longitudeHeader?: string;
    positionHeader?: string;
    altitudeHeader?: string;
    timeHeader?: string;
    speedHeader?: string;
    trackHeader?: string;
  },
): {
  coordinate: FlightTrackCoordinate;
  time: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
} | null => {
  const values = parseCsvLine(line);
  const row = columns.headers.reduce<Record<string, string>>(
    (acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    },
    {},
  );

  const position = parseCsvPosition(
    columns.positionHeader ? row[columns.positionHeader] : undefined,
  );
  const lat =
    columns.latitudeHeader && columns.longitudeHeader
      ? parseNumber(row[columns.latitudeHeader])
      : position?.lat;
  const lon =
    columns.latitudeHeader && columns.longitudeHeader
      ? parseNumber(row[columns.longitudeHeader])
      : position?.lon;
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return null;
  }

  const altitudeFeet = columns.altitudeHeader
    ? parseNumber(row[columns.altitudeHeader])
    : null;
  const coordinate: FlightTrackCoordinate =
    altitudeFeet === null ? [lon, lat] : [lon, lat, altitudeFeet * 0.3048];
  const time = columns.timeHeader
    ? toEpochSeconds(row[columns.timeHeader])
    : null;
  const groundSpeedKt = columns.speedHeader
    ? parseNumber(row[columns.speedHeader])
    : null;
  const trackDeg = columns.trackHeader
    ? parseNumber(row[columns.trackHeader])
    : null;

  return {
    coordinate,
    time,
    groundSpeedKt,
    trackDeg: trackDeg === null ? null : normalizeTrackDegrees(trackDeg),
  };
};

const parseCsvPosition = (value: string | undefined) => {
  if (!value) return null;
  const [latValue, lonValue] = value.split(',').map((part) => part.trim());
  const lat = parseNumber(latValue);
  const lon = parseNumber(lonValue);

  return lat === null || lon === null ? null : { lat, lon };
};

const findHeader = (headers: string[], candidates: string[]) => {
  return candidates.find((candidate) => headers.includes(candidate));
};

const parseNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDescriptionNumber = (
  description: string | null | undefined,
  label: string,
  unit?: string,
) => {
  if (!description) return null;
  const normalizedDescription = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&deg;/g, ' ')
    .replace(/\s+/g, ' ');
  const escapedUnit = unit ? `\\s*${unit}` : '';
  const match = new RegExp(
    `${label}:\\s*(-?\\d+(?:\\.\\d+)?)${escapedUnit}`,
    'i',
  ).exec(normalizedDescription);
  return match?.[1] ? parseNumber(match[1]) : null;
};

const normalizeTrackDegrees = (value: number) => ((value % 360) + 360) % 360;

const toEpochSeconds = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return Math.round(numeric > 10_000_000_000 ? numeric / 1000 : numeric);
  }

  const parsed = Date.parse(trimmed);
  if (!hasExplicitTimezone(trimmed)) return null;
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed / 1000);
};

const hasExplicitTimezone = (value: string) => {
  return /(?:z|utc|[+-]\d{2}:?\d{2})$/i.test(value.trim());
};

export const simplifyTrack = (
  track: FlightTrackPayload,
  toleranceMeters = SIMPLIFY_TOLERANCE_METERS,
): FlightTrackPayload => {
  if (track.coordinates.length <= 2) return track;

  const points = projectCoordinates(track.coordinates);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  const toleranceSquared = toleranceMeters * toleranceMeters;

  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDistanceSquared = -1;
    let maxIndex = -1;

    for (let index = start + 1; index < end; index++) {
      const point = points[index];
      const startPoint = points[start];
      const endPoint = points[end];
      if (!point || !startPoint || !endPoint) continue;

      const distanceSquared = perpendicularDistanceSquared(
        point,
        startPoint,
        endPoint,
      );
      if (distanceSquared > maxDistanceSquared) {
        maxDistanceSquared = distanceSquared;
        maxIndex = index;
      }
    }

    if (maxDistanceSquared > toleranceSquared && maxIndex !== -1) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  const coordinates: FlightTrackCoordinate[] = [];
  const pickedProperties = createAlignedPropertyPicker(track);
  track.coordinates.forEach((coordinate, index) => {
    if (!keep[index]) return;
    coordinates.push(coordinate);
    pickedProperties.pick(index);
  });

  return {
    coordinates,
    ...pickedProperties.toPayload(),
  };
};

const limitTrackPoints = (
  track: FlightTrackPayload,
  maxPoints: number,
): FlightTrackPayload => {
  if (track.coordinates.length <= maxPoints) return track;

  const coordinates: FlightTrackCoordinate[] = [];
  const pickedProperties = createAlignedPropertyPicker(track);
  const lastIndex = track.coordinates.length - 1;

  for (let index = 0; index < maxPoints; index++) {
    const sourceIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    const coordinate = track.coordinates[sourceIndex];
    if (!coordinate) continue;

    coordinates.push(coordinate);
    pickedProperties.pick(sourceIndex);
  }

  return {
    coordinates,
    ...pickedProperties.toPayload(),
  };
};

const createAlignedPropertyPicker = (track: FlightTrackPayload) => {
  const times: number[] = [];
  const groundSpeedKt: number[] = [];
  const trackDeg: number[] = [];

  return {
    pick(index: number) {
      const time = track.times?.[index];
      if (time !== undefined) times.push(time);

      const groundSpeed = track.groundSpeedKt?.[index];
      if (groundSpeed !== undefined) groundSpeedKt.push(groundSpeed);

      const trackDirection = track.trackDeg?.[index];
      if (trackDirection !== undefined) trackDeg.push(trackDirection);
    },
    toPayload(): Omit<FlightTrackPayload, 'coordinates'> {
      return {
        ...(track.times ? { times } : {}),
        ...(track.groundSpeedKt ? { groundSpeedKt } : {}),
        ...(track.trackDeg ? { trackDeg } : {}),
      };
    },
  };
};

const projectCoordinates = (coordinates: FlightTrackCoordinate[]) => {
  const referenceLat =
    coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
    coordinates.length;
  const xScale = METERS_PER_DEGREE * Math.cos((referenceLat * Math.PI) / 180);

  return coordinates.map(
    ([lon, lat]) => [lon * xScale, lat * METERS_PER_DEGREE] as const,
  );
};

const perpendicularDistanceSquared = (
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    return squaredDistance(point, start);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return squaredDistance(point, [start[0] + t * dx, start[1] + t * dy]);
};

const squaredDistance = (
  a: readonly [number, number],
  b: readonly [number, number],
) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};
