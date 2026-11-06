import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, beforeAll } from 'vitest';

import { parseTrackCandidates } from './parser';
import { flightTrackInputSchema } from './schema';

beforeAll(() => {
  Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });
});

const points = `<Placemark><TimeStamp><when>2026-10-31T10:17:40Z</when></TimeStamp><Point><coordinates>-2.28,53.36,0</coordinates></Point></Placemark>
<Placemark><TimeStamp><when>2026-10-31T22:36:40Z</when></TimeStamp><Point><coordinates>113.91,22.30,0</coordinates></Point></Placemark>`;

describe('temporary KML metadata', () => {
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

  it('leaves missing metadata empty rather than guessing from point names', () => {
    const [candidate] = parseTrackCandidates(
      `<kml><Document>${points}</Document></kml>`,
      'kml',
    );
    expect(candidate!.metadata).toEqual({
      flightIdentifiers: [],
      originCodes: [],
      destinationCodes: [],
    });
  });
});
