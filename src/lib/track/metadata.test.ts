import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, beforeAll } from 'vitest';

import { findTrackMismatches, type TrackMetadata } from './metadata';
import { parseTrackCandidates } from './parser';
import { flightTrackInputSchema } from './schema';

import type { FlightFormData } from '$lib/zod/flight';

beforeAll(() => {
  Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });
});

const points = `<Placemark><TimeStamp><when>2026-10-31T10:17:40Z</when></TimeStamp><Point><coordinates>-2.28,53.36,0</coordinates></Point></Placemark>
<Placemark><TimeStamp><when>2026-10-31T22:36:40Z</when></TimeStamp><Point><coordinates>113.91,22.30,0</coordinates></Point></Placemark>`;

describe('KML metadata', () => {
  it.each([
    {
      header: `<name>CX216/CPA216</name><description><![CDATA[<a href="https://www.flightradar24.com/airport/man/departures">MAN</a><a href="https://www.flightradar24.com/airport/hkg/arrivals">HKG</a>]]></description>`,
      identifiers: ['CX216', 'CPA216'],
      origin: ['MAN'],
      destination: ['HKG'],
    },
    {
      header:
        '<name>FlightAware CPA216 30-Oct-2026 (MAN / EGCC-HKG / VHHH)</name>',
      identifiers: ['CPA216'],
      origin: ['MAN', 'EGCC'],
      destination: ['HKG', 'VHHH'],
    },
  ])(
    'extracts identifiers and route without adding them to the saved track',
    ({ header, identifiers, origin, destination }) => {
      const [candidate] = parseTrackCandidates(
        `<kml><Document>${header}${points}</Document></kml>`,
        'kml',
      );
      expect(candidate!.metadata).toEqual({
        flightIdentifiers: identifiers,
        originCodes: origin,
        destinationCodes: destination,
      });
      expect(flightTrackInputSchema.parse(candidate!.track)).not.toHaveProperty(
        'metadata',
      );
      expect(candidate!.track).not.toHaveProperty('metadata');
    },
  );

  it.each(['N12345 A320', 'Flight 2b3c4d5e', 'My trip'])(
    'ignores KML names from other sources: %s',
    (name) => {
      const [candidate] = parseTrackCandidates(
        `<kml><Document><name>${name}</name>${points}</Document></kml>`,
        'kml',
      );
      expect(candidate!.metadata).toBeNull();
    },
  );
});

describe('track mismatches', () => {
  const metadata: TrackMetadata = {
    flightIdentifiers: ['CPA216'],
    originCodes: ['MAN', 'EGCC'],
    destinationCodes: ['HKG', 'VHHH'],
  };
  const form = {
    flightNumber: 'CX216',
    from: { iata: 'MAN', icao: 'EGCC' },
    to: { iata: 'HKG', icao: 'VHHH' },
  } as FlightFormData;

  it.each(['CX216', 'CPA216', '216', 'CX0216', ' cx 216 '])(
    'accepts the same flight written as %s',
    (flightNumber) => {
      expect(findTrackMismatches(metadata, { ...form, flightNumber })).toEqual(
        [],
      );
    },
  );

  it('matches airline codes that contain a digit', () => {
    expect(
      findTrackMismatches(
        { ...metadata, flightIdentifiers: ['EZY1234'] },
        { ...form, flightNumber: 'U21234' },
      ),
    ).toEqual([]);
  });

  it('skips the flight number when the track only has an alphanumeric callsign', () => {
    expect(
      findTrackMismatches(
        { ...metadata, flightIdentifiers: ['RYR1MK'] },
        { ...form, flightNumber: 'FR1234' },
      ),
    ).toEqual([]);
  });

  it('reports both airports when the route is reversed', () => {
    expect(
      findTrackMismatches(metadata, { ...form, from: form.to, to: form.from }),
    ).toEqual([
      expect.objectContaining({ field: 'departure', track: 'MAN / EGCC' }),
      expect.objectContaining({ field: 'arrival', track: 'HKG / VHHH' }),
    ]);
  });

  it('reports a different flight number', () => {
    expect(
      findTrackMismatches(metadata, { ...form, flightNumber: 'CX219' }),
    ).toEqual([
      {
        field: 'flightNumber',
        label: 'Flight number',
        track: 'CPA216',
        entered: 'CX219',
      },
    ]);
  });

  it('does not compare fields the form or the track leaves empty', () => {
    expect(findTrackMismatches(null, form)).toEqual([]);
    expect(
      findTrackMismatches(
        { flightIdentifiers: [], originCodes: [], destinationCodes: ['HKG'] },
        {
          ...form,
          from: null,
          flightNumber: null,
        } as unknown as FlightFormData,
      ),
    ).toEqual([]);
  });
});
