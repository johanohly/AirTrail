import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, beforeAll } from 'vitest';

import { parseTrackCandidates, parseTrackContent } from './parser';
import {
  MAX_STORED_FLIGHT_TRACK_POINTS,
  flightTrackInputSchema,
} from './schema';

beforeAll(() => {
  Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });
});

describe('track parser', () => {
  it('parses readsb trace tuples and splits authoritative leg markers', () => {
    const candidates = parseTrackCandidates(
      JSON.stringify({
        icao: '4cac8e',
        timestamp: 1_700_000_000,
        trace: [
          [0, 55, 12, 'ground', 4.2, 312.2, 3],
          [10.4, 55.1, 12.1, 1_000, 120, 90, 0],
          [1_000, 51.4, -0.4, 'ground', 0, null, 2],
          [1_010, 51.5, -0.5, 2_000, 140, 361, 1],
        ],
      }),
      'readsb',
      'trace.json',
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      legIndex: 1,
      startTime: 1_700_000_000,
      endTime: 1_700_000_010,
      startCoordinate: [12, 55, 0],
      endCoordinate: [12.1, 55.1, 304.8],
      track: {
        sourceFormat: 'readsb',
        sourceName: 'trace.json (leg 1)',
        originalPointCount: 2,
        times: [1_700_000_000, 1_700_000_010],
        groundSpeedKt: [4.2, 120],
        ground: [true, false],
        estimated: [true, false],
      },
    });
    expect(candidates[0]!.track.trackDeg?.[0]).toBeCloseTo(312.2);
    expect(candidates[0]!.track.trackDeg?.[1]).toBe(90);
    expect(candidates[1]).toMatchObject({
      legIndex: 2,
      track: {
        sourceName: 'trace.json (leg 2)',
        trackDeg: undefined,
        ground: [true, false],
        estimated: [false, true],
      },
    });
    expect(candidates[1]!.track.coordinates[1]![2]).toBeCloseTo(609.6);
  });

  it('keeps an unmarked readsb trace as one candidate', () => {
    const [candidate] = parseTrackCandidates(
      JSON.stringify({
        timestamp: 1_700_000_000,
        trace: [
          [0, 55, 12, 'ground', 0, 90, 0],
          [10, 56, 13, 1_000, 100, 91, 0],
        ],
      }),
      'readsb',
      'trace.json',
    );

    expect(candidate).toMatchObject({
      legIndex: null,
      track: {
        sourceFormat: 'readsb',
        sourceName: 'trace.json',
        originalPointCount: 2,
      },
    });
  });

  it('rejects JSON that is not a readsb trace', () => {
    expect(() =>
      parseTrackCandidates('{"flights":[]}', 'readsb', 'flights.json'),
    ).toThrow('needs timestamp and trace fields');
  });

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
            <ExtendedData>
              <Data name="ground"><value>true</value></Data>
              <Data name="estimated"><value>false</value></Data>
            </ExtendedData>
            <TimeStamp><when>2026-06-13T05:15:10+00:00</when></TimeStamp>
            <LookAt><heading>98</heading></LookAt>
            <Point><coordinates>12.644255,55.626736,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <description><![CDATA[Altitude: 1000 ft Speed: 8 kt Heading: 120&deg;]]></description>
            <ExtendedData>
              <Data name="ground"><value>false</value></Data>
              <Data name="estimated"><value>true</value></Data>
            </ExtendedData>
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
    expect(result.ground).toEqual([true, false]);
    expect(result.estimated).toEqual([false, true]);
  });

  it('parses helper KML ground descriptions as aligned point flags', () => {
    const result = parseTrackContent(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <description><![CDATA[<div><span><b>Ground/taxi:</b></span> <span>yes</span></div>]]></description>
            <TimeStamp><when>2026-06-13T05:15:10+00:00</when></TimeStamp>
            <Point><coordinates>12.644255,55.626736,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <description><![CDATA[<div><span><b>Altitude:</b></span> <span>1000 ft</span></div>]]></description>
            <TimeStamp><when>2026-06-13T05:15:17+00:00</when></TimeStamp>
            <Point><coordinates>12.644036,55.626755,304.8</coordinates></Point>
          </Placemark>
        </Document>
      </kml>`,
      'kml',
    );

    expect(result.ground).toEqual([true, false]);
    expect(result.estimated).toBeUndefined();
  });

  it('stores detailed tracks without simplifying them', () => {
    const rows = Array.from({ length: 2_500 }, (_, index) =>
      [index * 0.001, index === 1_250 ? 0.01 : 0].join(','),
    );

    const result = parseTrackContent(
      ['Longitude,Latitude', ...rows].join('\n'),
      'csv',
    );

    expect(result.coordinates).toHaveLength(2_500);
    expect(result.coordinates[0]).toEqual([0, 0]);
    expect(result.coordinates[1_250]).toEqual([1.25, 0.01]);
    expect(result.coordinates.at(-1)).toEqual([2.499, 0]);
    expect(flightTrackInputSchema.safeParse(result).success).toBe(true);
  });

  it('rejects tracks above the storage safety limit', () => {
    const rows = Array.from(
      { length: MAX_STORED_FLIGHT_TRACK_POINTS + 1 },
      (_, index) => `${index * 0.000_001},0`,
    );

    expect(() =>
      parseTrackContent(['Longitude,Latitude', ...rows].join('\n'), 'csv'),
    ).toThrow('The maximum is 100,000');
  });
});
