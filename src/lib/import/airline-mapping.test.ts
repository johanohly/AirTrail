import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { processFR24File } from './fr24';
import { processLogMyTripFile } from './logmytrip';
import { getPendingFlights, type PlatformOptions } from './model';
import { processOpenFlightsFile } from './openflights';

import type { Airline } from '$lib/db/types';
import { clearAirlineLookupCaches } from '$lib/utils/data/airlines';

const { installedAirlines, airBerlin, flyAir41, aircraft } = vi.hoisted(() => ({
  installedAirlines: [] as Airline[],
  airBerlin: {
    id: 1,
    name: 'Air Berlin',
    iata: 'AB',
    icao: 'BER',
    sourceId: null,
    iconPath: null,
  },
  flyAir41: {
    id: 2,
    name: 'Fly Air41',
    iata: null,
    icao: 'BER',
    sourceId: null,
    iconPath: null,
  },
  aircraft: { id: 1, name: 'Airbus A320', icao: 'A320', sourceId: null },
}));

vi.mock('$app/state', () => ({ page: { data: { user: { id: 'user-1' } } } }));
vi.mock('$lib/trpc', () => ({
  api: {
    airline: {
      getByIcao: {
        query: async (icao: string) =>
          installedAirlines.find((airline) => airline.icao === icao) ?? null,
      },
      getByIata: {
        query: async (iata: string) =>
          installedAirlines.find((airline) => airline.iata === iata) ?? null,
      },
      getByName: {
        query: async (name: string) =>
          installedAirlines.find((airline) => airline.name === name) ?? null,
      },
    },
  },
}));
vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao: async (icao: string) => ({ id: 1, icao, tz: 'UTC' }),
  getAirportByIata: async (iata: string) => ({ id: 1, iata, tz: 'UTC' }),
}));
vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao: async (icao: string) =>
    icao === 'A320' ? aircraft : null,
  getAircraftByName: async (name: string) =>
    name === 'Airbus A320' ? aircraft : null,
}));

const options: PlatformOptions = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal',
};

const openFlightsRow = (date: string, airlineOid: string, plane: string) =>
  [
    date,
    'ZRH',
    'BER',
    '',
    '',
    '',
    '01:25',
    '',
    '',
    '',
    '',
    plane,
    '',
    '',
    '',
    '',
    '',
    airlineOid,
    '',
  ].join(',');

const formats = [
  {
    name: 'FlightRadar24',
    process: processFR24File,
    unknownAircraftKey: 'A319',
    content: [
      'Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note',
      '2016-05-01,AB8565,Zurich (ZRH/LSZH),Berlin / Tegel (TXL/EDDT),07:00:00,08:25:00,01:25:00,Air Berlin (AB/BER),Airbus A320 (A320),,,1,1,2,',
      '2025-05-01,,Zurich (ZRH/LSZH),Berlin (BER/EDDB),07:00:00,08:25:00,01:25:00,Fly Air41 (/BER),Airbus A319 (A319),,,1,1,2,',
    ].join('\n'),
  },
  {
    name: 'OpenFlights',
    process: processOpenFlightsFile,
    unknownAircraftKey: 'A319',
    content: [
      'Date,From,To,Flight Number,Airline,Distance,Duration,Seat,Seat Type,Class,Reason,Plane,Registration,Trip,Note,From OID,To OID,Airline OID,Plane OID',
      openFlightsRow('2016-05-01', '1', 'Airbus A320'),
      openFlightsRow('2025-05-01', '2', 'Airbus A319'),
    ].join('\n'),
  },
  {
    name: 'LogMyTrip',
    process: processLogMyTripFile,
    unknownAircraftKey: 'Airbus A319',
    content: [
      'Departure airport,Arrival airport,Airline,Aircraft,Departure time',
      'Zurich (ZRH/LSZH),Berlin / Tegel (TXL/EDDT),Air Berlin (AB/BER),Airbus A320,2016-05-01 07:00:00',
      'Zurich (ZRH/LSZH),Berlin (BER/EDDB),Fly Air41 (/BER),Airbus A319,2025-05-01 07:00:00',
    ].join('\n'),
  },
];

describe.each(formats)(
  '$name airline mappings',
  ({ process, content, unknownAircraftKey }) => {
    beforeEach(() => {
      installedAirlines.length = 0;
      clearAirlineLookupCaches();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => ({
          ok: true,
          text: async () =>
            url.endsWith('/airlines.dat')
              ? '1,"Air Berlin",\\N,"AB","BER"\n2,"Fly Air41",\\N,"","BER"'
              : 'Airbus A320,320,A320\nAirbus A319,319,A319',
        })),
      );
    });

    afterAll(() => vi.unstubAllGlobals());

    it('preserves a matched airline while its flight awaits aircraft mapping', async () => {
      installedAirlines.push(flyAir41);
      const first = await process(content, options);
      expect(first.flights[0]?.airline).toBeNull();
      expect(first.flights[1]?.airline).toEqual(flyAir41);
      expect(first.unknowns.aircraft).toEqual({ [unknownAircraftKey]: [1] });
      expect(
        getPendingFlights(first.flights, first.unknowns, new Set()),
      ).toEqual([]);
      const [airlineKey] = Object.keys(first.unknowns.airlines);
      expect(first.unknowns.airlines[airlineKey!]).toEqual([0]);

      const mapped = await process(content, {
        ...options,
        airlineMapping: { [airlineKey!]: airBerlin },
        aircraftMapping: {
          [unknownAircraftKey]: {
            ...aircraft,
            icao: 'A319',
            name: 'Airbus A319',
          },
        },
      });
      const pending = getPendingFlights(
        mapped.flights,
        mapped.unknowns,
        new Set(),
      );
      expect(pending.map(({ flight }) => flight.airline)).toEqual([
        airBerlin,
        flyAir41,
      ]);
      expect(mapped.unknowns.airlines).toEqual({});
    });

    it('maps unresolved airlines sharing a code independently across retries', async () => {
      const first = await process(content, options);
      expect(first.unknowns.airlines).toEqual({
        'Air Berlin (AB/BER)': [0],
        'Fly Air41 (/BER)': [1],
      });

      const partial = await process(content, {
        ...options,
        airlineMapping: { 'Air Berlin (AB/BER)': airBerlin },
      });
      expect(partial.flights[0]?.airline).toEqual(airBerlin);
      expect(partial.flights[1]?.airline).toBeNull();
      expect(partial.unknowns.airlines).toEqual({ 'Fly Air41 (/BER)': [1] });

      const mapped = await process(content, {
        ...options,
        airlineMapping: {
          'Air Berlin (AB/BER)': airBerlin,
          'Fly Air41 (/BER)': flyAir41,
        },
        aircraftMapping: {
          [unknownAircraftKey]: {
            ...aircraft,
            icao: 'A319',
            name: 'Airbus A319',
          },
        },
      });
      const pending = getPendingFlights(
        mapped.flights,
        mapped.unknowns,
        new Set([0]),
      );
      expect(pending).toHaveLength(1);
      expect(pending[0]?.flight.airline).toEqual(flyAir41);
      expect(mapped.unknowns.airlines).toEqual({});
    });
  },
);
