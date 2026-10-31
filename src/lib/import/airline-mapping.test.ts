import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { processFR24File } from './fr24';
import { processLogMyTripFile } from './logmytrip';
import type { PlatformOptions } from './model';
import { processOpenFlightsFile } from './openflights';

vi.mock('$app/state', () => ({ page: { data: { user: { id: 'user-1' } } } }));
vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByCodes: async () => null,
  getAirlineByIata: async () => null,
  getAirlineByName: async () => null,
}));
vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao: async (icao: string) => ({ id: 1, icao, tz: 'UTC' }),
  getAirportByIata: async (iata: string) => ({ id: 1, iata, tz: 'UTC' }),
}));
vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao: async () => null,
  getAircraftByName: async () => null,
}));

const options: PlatformOptions = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal',
};

const airBerlin = {
  id: 1,
  name: 'Air Berlin',
  iata: 'AB',
  icao: 'BER',
  sourceId: null,
  iconPath: null,
};

const openFlightsRow = (date: string, airlineOid: string) =>
  `${date},ZRH,BER,,,,01:25,,,,,,,,,,,${airlineOid},`;

const formats = [
  {
    name: 'FlightRadar24',
    process: processFR24File,
    content: [
      'Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Seat type,Flight class,Flight reason,Note',
      '2016-05-01,,Zurich (ZRH/LSZH),Berlin (BER/EDDB),07:00:00,08:25:00,01:25:00,Air Berlin (AB/BER),,,,1,1,2,',
      '2025-05-01,,Zurich (ZRH/LSZH),Berlin (BER/EDDB),07:00:00,08:25:00,01:25:00,Fly Air41 (/BER),,,,1,1,2,',
    ].join('\n'),
  },
  {
    name: 'OpenFlights',
    process: processOpenFlightsFile,
    content: [
      'Date,From,To,Flight Number,Airline,Distance,Duration,Seat,Seat Type,Class,Reason,Plane,Registration,Trip,Note,From OID,To OID,Airline OID,Plane OID',
      openFlightsRow('2016-05-01', '1'),
      openFlightsRow('2025-05-01', '2'),
    ].join('\n'),
  },
  {
    name: 'LogMyTrip',
    process: processLogMyTripFile,
    content: [
      'Departure airport,Arrival airport,Airline,Aircraft,Departure time',
      'Zurich (ZRH/LSZH),Berlin (BER/EDDB),Air Berlin (AB/BER),,2016-05-01 07:00:00',
      'Zurich (ZRH/LSZH),Berlin (BER/EDDB),Fly Air41 (/BER),,2025-05-01 07:00:00',
    ].join('\n'),
  },
];

describe.each(formats)('$name airline mappings', ({ process, content }) => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        text: async () =>
          url.endsWith('/airlines.dat')
            ? '1,"Air Berlin",\\N,"AB","BER"\n2,"Fly Air41",\\N,"","BER"'
            : '',
      })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('applies a mapping only to the source airline when a code is reused', async () => {
    const first = await process(content, options);
    expect(first.unknowns.airlines).toEqual({
      'Air Berlin (AB/BER)': [0],
      'Fly Air41 (/BER)': [1],
    });

    const mapped = await process(content, {
      ...options,
      airlineMapping: { 'Air Berlin (AB/BER)': airBerlin },
    });
    expect(mapped.flights[0]?.airline).toEqual(airBerlin);
    expect(mapped.flights[1]?.airline).toBeNull();
    expect(mapped.unknowns.airlines).toEqual({ 'Fly Air41 (/BER)': [1] });
  });
});
