import { gpx, kml } from '@tmcw/togeojson';

import {
  type FlightTrackCoordinate,
  type FlightTrackInput,
  type FlightTrackSourceFormat,
  MAX_STORED_FLIGHT_TRACK_POINTS,
} from './schema';

import { parseCsvLine, sanitizeHeader } from '$lib/utils/csv';

export type ParsedTrackFile = FlightTrackInput & {
  originalPointCount: number;
};

type RawTrack = {
  coordinates: FlightTrackCoordinate[];
  times?: number[];
  groundSpeedKt?: number[];
  trackDeg?: number[];
  ground?: boolean[];
  estimated?: boolean[];
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
  if (raw.coordinates.length > MAX_STORED_FLIGHT_TRACK_POINTS) {
    throw new Error(
      `Track contains ${raw.coordinates.length.toLocaleString()} points. The maximum is ${MAX_STORED_FLIGHT_TRACK_POINTS.toLocaleString()}.`,
    );
  }

  const originalPointCount = raw.coordinates.length;

  return {
    ...raw,
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
  const ground: boolean[] = [];
  const estimated: boolean[] = [];
  const shouldParseGround = hasKmlBooleanProperty(document, 'ground', [
    'Ground/taxi',
  ]);
  const shouldParseEstimated = hasKmlBooleanProperty(document, 'estimated', [
    'Estimated',
  ]);

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

    const description = placemark
      .getElementsByTagName('description')[0]
      ?.textContent?.trim();
    const groundFlag =
      parseExtendedDataBoolean(placemark, 'ground') ??
      parseDescriptionBoolean(description, 'Ground/taxi');
    const estimatedFlag =
      parseExtendedDataBoolean(placemark, 'estimated') ??
      parseDescriptionBoolean(description, 'Estimated');

    coordinates.push(coordinate);
    times.push(time);
    if (shouldParseGround) ground.push(groundFlag ?? false);
    if (shouldParseEstimated) estimated.push(estimatedFlag ?? false);

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
    ground: ground.length === coordinates.length ? ground : undefined,
    estimated: estimated.length === coordinates.length ? estimated : undefined,
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

const parseBoolean = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  return null;
};

const normalizeDescription = (description: string | null | undefined) =>
  description
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&deg;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseDescriptionBoolean = (
  description: string | null | undefined,
  label: string,
) => {
  const normalizedDescription = normalizeDescription(description);
  if (!normalizedDescription) return null;
  const match = new RegExp(`${label}:\\s*(true|false|yes|no|1|0)`, 'i').exec(
    normalizedDescription,
  );
  return parseBoolean(match?.[1]);
};

const getExtendedDataValue = (placemark: Element, name: string) => {
  for (const data of Array.from(placemark.getElementsByTagName('Data'))) {
    if (data.getAttribute('name') !== name) continue;
    return data.getElementsByTagName('value')[0]?.textContent;
  }

  for (const data of Array.from(placemark.getElementsByTagName('SimpleData'))) {
    if (data.getAttribute('name') === name) return data.textContent;
  }
};

const parseExtendedDataBoolean = (placemark: Element, name: string) =>
  parseBoolean(getExtendedDataValue(placemark, name));

const hasKmlBooleanProperty = (
  document: Document,
  dataName: string,
  descriptionLabels: string[],
) => {
  if (
    Array.from(document.getElementsByTagName('Data')).some(
      (data) => data.getAttribute('name') === dataName,
    ) ||
    Array.from(document.getElementsByTagName('SimpleData')).some(
      (data) => data.getAttribute('name') === dataName,
    )
  ) {
    return true;
  }

  return Array.from(document.getElementsByTagName('description')).some(
    (description) => {
      const normalized = normalizeDescription(description.textContent);
      return (
        !!normalized &&
        descriptionLabels.some((label) =>
          new RegExp(`${label}:\\s*(true|false|yes|no|1|0)`, 'i').test(
            normalized,
          ),
        )
      );
    },
  );
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
