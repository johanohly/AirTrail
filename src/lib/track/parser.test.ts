import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, beforeAll } from 'vitest';

import { parseTrackContent, simplifyTrack } from './parser';
import { MAX_FLIGHT_TRACK_POINTS, flightTrackInputSchema } from './schema';

beforeAll(() => {
  globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
});

describe('track parser', () => {
  it('parses GPX coordinates, altitude, and times', () => {
    const result = parseTrackContent(
      `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="AirTrail test">
        <trk>
          <name>Test flight</name>
          <trkseg>
            <trkpt lat="55.618" lon="12.656">
              <ele>5</ele>
              <time>2026-01-01T10:00:00Z</time>
            </trkpt>
            <trkpt lat="55.620" lon="12.700">
              <ele>320</ele>
              <time>2026-01-01T10:01:00Z</time>
            </trkpt>
          </trkseg>
        </trk>
      </gpx>`,
      'gpx',
      'flight.gpx',
    );

    expect(result.sourceFormat).toBe('gpx');
    expect(result.sourceName).toBe('flight.gpx');
    expect(result.coordinates).toEqual([
      [12.656, 55.618, 5],
      [12.7, 55.62, 320],
    ]);
    expect(result.times).toEqual([1767261600, 1767261660]);
  });

  it('parses KML LineString coordinates with altitude', () => {
    const result = parseTrackContent(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                -73.7781,40.6413,4 -0.4543,51.4700,25
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>`,
      'kml',
    );

    expect(result.sourceFormat).toBe('kml');
    expect(result.coordinates).toEqual([
      [-73.7781, 40.6413, 4],
      [-0.4543, 51.47, 25],
    ]);
    expect(result.times).toBeUndefined();
  });

  it('parses CSV coordinates, feet altitude, and ISO timestamps', () => {
    const result = parseTrackContent(
      `Timestamp,Latitude,Longitude,Altitude
2026-01-01T10:00:00Z,55.618,12.656,1000
2026-01-01T10:01:00Z,55.620,12.700,2000`,
      'csv',
    );

    expect(result.sourceFormat).toBe('csv');
    expect(result.coordinates).toEqual([
      [12.656, 55.618, 304.8],
      [12.7, 55.62, 609.6],
    ]);
    expect(result.times).toEqual([1767261600, 1767261660]);
  });

  it('keeps times aligned when simplifying', () => {
    const coordinates = Array.from({ length: 20 }, (_, index) => [
      index * 0.001,
      index === 10 ? 0.01 : 0,
    ]) as [number, number][];
    const times = coordinates.map((_, index) => index);

    const simplified = simplifyTrack({ coordinates, times }, 10);

    expect(simplified.coordinates.length).toBeLessThan(coordinates.length);
    expect(simplified.coordinates[0]).toEqual(coordinates[0]);
    expect(simplified.coordinates.at(-1)).toEqual(coordinates.at(-1));
    expect(simplified.coordinates).toContainEqual(coordinates[10]);
    expect(simplified.times).toHaveLength(simplified.coordinates.length);
    expect(simplified.times).toContain(10);
  });

  it('limits parsed tracks to the server-side point cap', () => {
    const rows = Array.from({ length: MAX_FLIGHT_TRACK_POINTS + 500 }, (_, i) =>
      [i % 2 ? '0.002' : '0', (i * 0.001).toString()].join(','),
    );

    const result = parseTrackContent(
      ['Latitude,Longitude', ...rows].join('\n'),
      'csv',
    );

    expect(result.coordinates).toHaveLength(MAX_FLIGHT_TRACK_POINTS);
    expect(result.coordinates[0]).toEqual([0, 0]);
    expect(result.coordinates.at(-1)).toEqual([
      (MAX_FLIGHT_TRACK_POINTS + 499) * 0.001,
      0.002,
    ]);
    expect(flightTrackInputSchema.safeParse(result).success).toBe(true);
  });
});
