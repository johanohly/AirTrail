import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, beforeAll } from 'vitest';

import { parseTrackContent, simplifyTrack } from './parser';
import { MAX_FLIGHT_TRACK_POINTS, flightTrackInputSchema } from './schema';

beforeAll(() => {
  Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });
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

  it('keeps XML times aligned when invalid coordinates are filtered', () => {
    const result = parseTrackContent(
      `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="AirTrail test">
        <trk>
          <trkseg>
            <trkpt lat="bad" lon="12.000">
              <time>2026-01-01T09:59:00Z</time>
            </trkpt>
            <trkpt lat="55.618" lon="12.656">
              <time>2026-01-01T10:00:00Z</time>
            </trkpt>
            <trkpt lat="55.620" lon="12.700">
              <time>2026-01-01T10:01:00Z</time>
            </trkpt>
          </trkseg>
        </trk>
      </gpx>`,
      'gpx',
    );

    expect(result.coordinates).toEqual([
      [12.656, 55.618],
      [12.7, 55.62],
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

  it('uses explicit UTC CSV columns and ignores timezone-less datetimes', () => {
    const result = parseTrackContent(
      `Timestamp,UTC,Latitude,Longitude
2026-01-01T11:00:00,2026-01-01T10:00:00Z,55.618,12.656
2026-01-01T11:01:00,2026-01-01T10:01:00Z,55.620,12.700`,
      'csv',
    );
    const withoutTimezone = parseTrackContent(
      `Timestamp,Latitude,Longitude
2026-01-01T10:00:00,55.618,12.656
2026-01-01T10:01:00,55.620,12.700`,
      'csv',
    );

    expect(result.times).toEqual([1767261600, 1767261660]);
    expect(withoutTimezone.times).toBeUndefined();
  });

  it('parses FR24 CSV position, speed, and direction columns', () => {
    const result = parseTrackContent(
      `Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction
1781327392,2026-06-13T05:09:52Z,SAS44D,"55.626709,12.644473",0,0,101
1781327710,2026-06-13T05:15:10Z,SAS44D,"55.626736,12.644255",1000,3,98`,
      'csv',
    );

    expect(result.coordinates).toEqual([
      [12.644473, 55.626709, 0],
      [12.644255, 55.626736, 304.8],
    ]);
    expect(result.times).toEqual([1781327392, 1781327710]);
    expect(result.groundSpeedKt).toEqual([0, 3]);
    expect(result.trackDeg).toEqual([101, 98]);
  });

  it('parses FR24 KML point placemarks with speed and heading', () => {
    const result = parseTrackContent(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <description><![CDATA[Altitude: 0 ft Speed: 3 kt Heading: 98&deg;]]></description>
            <TimeStamp><when>2026-06-13T05:15:10+00:00</when></TimeStamp>
            <LookAt><heading>98</heading></LookAt>
            <Point><coordinates>12.644255,55.626736,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <description><![CDATA[Altitude: 1000 ft Speed: 8 kt Heading: 120&deg;]]></description>
            <TimeStamp><when>2026-06-13T05:15:17+00:00</when></TimeStamp>
            <LookAt><heading>120</heading></LookAt>
            <Point><coordinates>12.644036,55.626755,304.8</coordinates></Point>
          </Placemark>
          <Placemark>
            <LineString>
              <coordinates>0,0,0 1,1,1</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>`,
      'kml',
    );

    expect(result.coordinates).toEqual([
      [12.644255, 55.626736, 0],
      [12.644036, 55.626755, 304.8],
    ]);
    expect(result.times).toEqual([1781327710, 1781327717]);
    expect(result.groundSpeedKt).toEqual([3, 8]);
    expect(result.trackDeg).toEqual([98, 120]);
  });

  it('keeps track properties aligned when simplifying', () => {
    const coordinates = Array.from({ length: 20 }, (_, index) => [
      index * 0.001,
      index === 10 ? 0.01 : 0,
    ]) as [number, number][];
    const times = coordinates.map((_, index) => index);
    const groundSpeedKt = coordinates.map((_, index) => index * 10);
    const trackDeg = coordinates.map((_, index) => index);

    const simplified = simplifyTrack(
      { coordinates, times, groundSpeedKt, trackDeg },
      10,
    );

    expect(simplified.coordinates.length).toBeLessThan(coordinates.length);
    expect(simplified.coordinates[0]).toEqual(coordinates[0]);
    expect(simplified.coordinates.at(-1)).toEqual(coordinates.at(-1));
    expect(simplified.coordinates).toContainEqual(coordinates[10]);
    expect(simplified.times).toHaveLength(simplified.coordinates.length);
    expect(simplified.times).toContain(10);
    expect(simplified.groundSpeedKt).toHaveLength(
      simplified.coordinates.length,
    );
    expect(simplified.groundSpeedKt).toContain(100);
    expect(simplified.trackDeg).toHaveLength(simplified.coordinates.length);
    expect(simplified.trackDeg).toContain(10);
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
