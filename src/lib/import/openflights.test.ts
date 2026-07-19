import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { processOpenFlightsFile } from './openflights';

const {
  getAirportByIata,
  getAirportByIcao,
  getAirlineByIata,
  getAirlineByIcao,
  getAirlineByName,
  getAircraftByIcao,
  getAircraftByName,
} = vi.hoisted(() => ({
  getAirportByIata: vi.fn(async (iata: string) => ({
    id: iata,
    iata,
    tz: 'UTC',
  })),
  getAirportByIcao: vi.fn(),
  getAirlineByIata: vi.fn(),
  getAirlineByIcao: vi.fn(),
  getAirlineByName: vi.fn(),
  getAircraftByIcao: vi.fn(async () => null),
  getAircraftByName: vi.fn(async () => null),
}));

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: {
        id: 'user-1',
      },
    },
  },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIata,
  getAirportByIcao,
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIata,
  getAirlineByIcao,
  getAirlineByName,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao,
  getAircraftByName,
}));

const openFlightsCsv = [
  [
    'Date',
    'From',
    'To',
    'Flight Number',
    'Airline',
    'Distance',
    'Duration',
    'Seat',
    'Seat Type',
    'Class',
    'Reason',
    'Plane',
    'Registration',
    'Trip',
    'Note',
    'From OID',
    'To OID',
    'Airline OID',
    'Plane OID',
  ].join(','),
  [
    '2025-01-01',
    'CPH',
    'LHR',
    '',
    '',
    '',
    '02:00',
    '',
    '',
    '',
    '',
    'Boeing 737-300 (winglets)',
    '',
    '',
    '',
    '',
    '',
    '',
    '1',
  ].join(','),
].join('\n');

describe('processOpenFlightsFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        text: async () =>
          url.endsWith('/planes.dat')
            ? 'Boeing 737-300 (winglets),73C,B733'
            : '',
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('reports and applies mappings for unknown OpenFlights aircraft', async () => {
    const options = {
      filterOwner: false,
      airlineFromFlightNumber: false,
      importMode: 'personal' as const,
    };

    const unresolved = await processOpenFlightsFile(openFlightsCsv, options);

    expect(unresolved.flights).toHaveLength(1);
    expect(unresolved.flights[0]?.aircraft).toBeNull();
    expect(unresolved.unknowns.aircraft).toEqual({ B733: [0] });

    const mappedAircraft = {
      id: 8,
      name: 'Boeing 737-300',
      icao: 'B733',
      sourceId: 'boeing-737-300',
    };
    const resolved = await processOpenFlightsFile(openFlightsCsv, {
      ...options,
      aircraftMapping: { B733: mappedAircraft },
    });

    expect(resolved.flights[0]?.aircraft).toEqual(mappedAircraft);
    expect(resolved.unknowns.aircraft).toEqual({});
  });
});
