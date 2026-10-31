import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { processOpenFlightsFile } from './openflights';

const {
  getAirportByIata,
  getAirportByIcao,
  getAirlineByIata,
  getAirlineByCodes,
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
  getAirlineByCodes: vi.fn(),
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
  getAirlineByCodes,
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

const OPENFLIGHTS_AIRLINES = [
  '3532,"Monarch Airlines",\\N,"ZB","MON"',
  '9001,"Iata Only Air",\\N,"ZB",""',
].join('\n');

const AIR_ALBANIA = { id: 1, name: 'Air Albania', icao: 'ABN', iata: 'ZB' };

const airlineRow = (airlineOid: string, flightNumber = '') =>
  [
    '2017-01-01',
    'CPH',
    'LHR',
    flightNumber,
    ...Array<string>(2).fill(''),
    '02:00',
    ...Array<string>(10).fill(''),
    airlineOid,
    '',
  ].join(',');

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
            : OPENFLIGHTS_AIRLINES,
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

  describe('airline lookup', () => {
    const options = {
      filterOwner: false,
      airlineFromFlightNumber: false,
      importMode: 'personal' as const,
    };
    const header = openFlightsCsv.split('\n')[0];

    beforeEach(() => {
      getAirlineByCodes.mockResolvedValue(null);
      getAirlineByName.mockResolvedValue(null);
      getAirlineByIata.mockResolvedValue(AIR_ALBANIA);
    });

    it('asks to map an airline whose IATA code was reused by another', async () => {
      const result = await processOpenFlightsFile(
        `${header}\n${airlineRow('3532')}`,
        options,
      );

      expect(getAirlineByCodes).toHaveBeenCalledWith(
        'MON',
        'ZB',
        'Monarch Airlines',
      );
      expect(result.flights[0]?.airline).toBeNull();
      expect(result.unknowns.airlines).toEqual({
        'Monarch Airlines (ZB/MON)': [0],
      });
    });

    it('keeps one mapping entry for an airline across codeshare flight numbers', async () => {
      const result = await processOpenFlightsFile(
        `${header}\n${airlineRow('3532', 'ZB123')}\n${airlineRow('3532', 'BA456')}`,
        { ...options, airlineFromFlightNumber: true },
      );

      expect(result.unknowns.airlines).toEqual({
        'Monarch Airlines (ZB/MON)': [0, 1],
      });
    });

    it('still matches by IATA code when the source has no ICAO code', async () => {
      const result = await processOpenFlightsFile(
        `${header}\n${airlineRow('9001')}`,
        options,
      );

      expect(result.flights[0]?.airline).toEqual(AIR_ALBANIA);
      expect(result.unknowns.airlines).toEqual({});
    });

    it('still matches a flight number IATA code when the source has no airline', async () => {
      const result = await processOpenFlightsFile(
        `${header}\n${airlineRow('', 'ZB123')}`,
        { ...options, airlineFromFlightNumber: true },
      );

      expect(result.flights[0]?.airline).toEqual(AIR_ALBANIA);
    });

    it('still matches by name when the codes are rejected', async () => {
      getAirlineByName.mockResolvedValue({
        id: 2,
        name: 'Monarch Airlines',
        icao: null,
        iata: null,
      });

      const result = await processOpenFlightsFile(
        `${header}\n${airlineRow('3532')}`,
        options,
      );

      expect(result.flights[0]?.airline?.name).toBe('Monarch Airlines');
    });
  });
});
