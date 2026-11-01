import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processLogMyTripFile } from './logmytrip';

const {
  getAirportByIcao,
  getAirportByIata,
  getAirlineByCodes,
  getAirlineByIata,
  getAirlineByName,
  getAircraftByName,
} = vi.hoisted(() => {
  const airports: Record<
    string,
    { id: number; iata: string; icao: string; tz: string }
  > = {
    LHBP: { id: 1, iata: 'BUD', icao: 'LHBP', tz: 'Europe/Budapest' },
    // Same UTC offset as Kyiv in winter
    UKKK: { id: 2, iata: 'IEV', icao: 'UKKK', tz: 'Europe/Helsinki' },
    LOWW: { id: 4, iata: 'VIE', icao: 'LOWW', tz: 'Europe/Vienna' },
    EBAW: { id: 5, iata: 'ANR', icao: 'EBAW', tz: 'Europe/Brussels' },
    EDDH: { id: 6, iata: 'HAM', icao: 'EDDH', tz: 'Europe/Berlin' },
    EDDV: { id: 7, iata: 'HAJ', icao: 'EDDV', tz: 'Europe/Berlin' },
  };
  return {
    getAirportByIcao: vi.fn(
      async (icao: string) => airports[icao.toUpperCase()] ?? null,
    ),
    getAirportByIata: vi.fn(
      async (iata: string) =>
        Object.values(airports).find((a) => a.iata === iata.toUpperCase()) ??
        null,
    ),
    getAirlineByCodes: vi.fn(async (icao: string) => ({ id: 1, icao })),
    getAirlineByIata: vi.fn(async () => null),
    getAirlineByName: vi.fn(async () => null),
    getAircraftByName: vi.fn(async (name: string) => ({ id: 1, name })),
  };
});

vi.mock('$app/state', () => ({
  page: { data: { user: { id: 'user-1' } } },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao,
  getAirportByIata,
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByCodes,
  getAirlineByIata,
  getAirlineByName,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByName,
}));

const options = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal' as const,
};

const BUD = 'Budapest Ferenc Liszt International Airport (BUD/LHBP)';
const IEV = 'Kiev Zhuliany International Airport (IEV/UKKK)';
const VIE = 'Vienna International Airport (VIE/LOWW)';

const toCsv = (rows: Record<string, string>[]) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [
    headers.map(quote).join(','),
    ...rows.map((row) => headers.map((h) => quote(row[h] ?? '')).join(',')),
  ].join('\n');
};

describe('processLogMyTripFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports a flight with local times, seat info and a note', async () => {
    const content = toCsv([
      {
        'Operated as': 'W6 2473',
        'Marketed as': 'AF5240',
        'Departure airport': BUD,
        'Arrival airport': IEV,
        Airline: 'Wizz Air (W6/WZZ)',
        Aircraft: 'Airbus A320',
        'Departure time': '2013-02-01 10:30:00',
        'Arrival time': '2013-02-01 13:15:00',
        'Tail number': 'HA-LWL',
        'Seat number': '20D',
        'Seat type': 'Window',
        'Flight class': 'Economy+',
        'Flight reason': 'Vacations',
        Companions: '["Friends","Alone"]',
        'Booking number': 'ABC123',
        Duration: '105',
        'General review': 'Great flight (4)',
        Cancelled: 'FALSE',
      },
    ]);

    const result = await processLogMyTripFile(content, options);

    expect(result.skippedRows).toBe(0);
    expect(result.flights).toHaveLength(1);
    expect(getAirportByIcao).toHaveBeenCalledWith('LHBP');
    expect(getAirlineByCodes).toHaveBeenCalledWith('WZZ', 'W6', 'Wizz Air');
    expect(getAircraftByName).toHaveBeenCalledWith('Airbus A320');

    const flight = result.flights[0]!;
    expect(flight.date).toBe('2013-02-01');
    expect(flight.departure).toBe('2013-02-01T09:30:00.000+00:00');
    expect(flight.arrival).toBe('2013-02-01T11:15:00.000+00:00');
    expect(flight.duration).toBe(6300);
    expect(flight.flightNumber).toBe('W62473');
    expect(flight.aircraftReg).toBe('HA-LWL');
    expect(flight.note).toBe(
      'PNR: ABC123 | Marketed as: AF5240 | With: Friends | Great flight (rating 4)',
    );
    expect(flight.passengers[0]).toMatchObject({
      userId: 'user-1',
      guestName: null,
      seat: 'window',
      seatNumber: '20D',
      seatClass: 'economy+',
      flightReason: 'leisure',
    });
  });

  it('asks to map an airline whose ICAO code was reused', async () => {
    getAirlineByCodes.mockResolvedValueOnce(null as never);

    const content = toCsv([
      {
        'Operated as': 'AB8498',
        'Departure airport': VIE,
        'Arrival airport': BUD,
        Airline: 'Air Berlin (AB/BER)',
        'Departure time': '2017-01-06 20:40:00',
        'Arrival time': '2017-01-06 22:10:00',
        Cancelled: 'FALSE',
      },
    ]);

    const result = await processLogMyTripFile(content, options);

    expect(getAirlineByCodes).toHaveBeenCalledWith('BER', 'AB', 'Air Berlin');
    expect(result.flights[0]?.airline).toBeNull();
    expect(result.unknowns.airlines).toEqual({ 'Air Berlin (AB/BER)': [0] });
  });

  it('skips cancelled flights', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const content = toCsv([
      {
        'Operated as': 'EW7751',
        'Departure airport': VIE,
        'Arrival airport': BUD,
        'Departure time': '2017-05-15 20:00:01',
        'Arrival time': '2017-05-15 21:30:01',
        Cancelled: 'TRUE',
        'Cancellation reason': 'Missed',
      },
    ]);

    const result = await processLogMyTripFile(content, options);

    expect(result.flights).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
    expect(warn).toHaveBeenCalledWith('[LogMyTrip] Skipping cancelled flight', {
      operatedAs: 'EW7751',
      departureTime: '2017-05-15 20:00:01',
    });
    warn.mockRestore();
  });

  it('logs rows skipped because an airport code is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const content = toCsv([
      {
        'Operated as': 'EW7751',
        'Departure airport': '',
        'Arrival airport': BUD,
        'Departure time': '2017-05-15 20:00:01',
        Cancelled: 'FALSE',
      },
    ]);

    const result = await processLogMyTripFile(content, options);

    expect(result.flights).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      '[LogMyTrip] Skipping row with missing airport code',
      {
        operatedAs: 'EW7751',
        departureTime: '2017-05-15 20:00:01',
        departureAirport: '',
        arrivalAirport: BUD,
      },
    );
    warn.mockRestore();
  });

  it('imports unknown actual times and keeps real scheduled times', async () => {
    const content = toCsv([
      {
        'Operated as': 'XW104',
        'Departure airport': VIE,
        'Arrival airport': BUD,
        'Departure time': '2011-07-09 00:00:00',
        'Arrival time': '2011-07-09 00:00:00',
        'Departure scheduled time': '2011-07-09 10:10:00',
        'Arrival scheduled time': '2011-07-09 15:00:00',
        Duration: '85',
        Cancelled: 'FALSE',
      },
    ]);

    const flight = (await processLogMyTripFile(content, options)).flights[0]!;

    expect(flight.date).toBe('2011-07-09');
    expect(flight.departure).toBeNull();
    expect(flight.arrival).toBeNull();
    expect(flight.departureScheduled).toBe('2011-07-09T08:10:00.000+00:00');
    expect(flight.arrivalScheduled).toBe('2011-07-09T13:00:00.000+00:00');
    expect(flight.duration).toBe(5100);
  });

  it('derives the arrival from the duration when it is before the departure', async () => {
    const content = toCsv([
      {
        'Operated as': 'OS1',
        'Departure airport': VIE,
        'Arrival airport': BUD,
        'Departure time': '2019-07-28 23:30:00',
        'Arrival time': '2019-07-28 00:30:00',
        Duration: '60',
        Cancelled: 'FALSE',
      },
    ]);

    const flight = (await processLogMyTripFile(content, options)).flights[0]!;

    expect(flight.departure).toBe('2019-07-28T21:30:00.000+00:00');
    expect(new Date(flight.arrival!).toISOString()).toBe(
      '2019-07-28T22:30:00.000Z',
    );
    expect(flight.duration).toBe(3600);
  });

  it('imports actual and scheduled arrivals when departures are unknown', async () => {
    const content = toCsv([
      {
        'Operated as': 'EW7751',
        'Departure airport': VIE,
        'Arrival airport': BUD,
        'Departure time': '2017-05-15 00:00:00',
        'Arrival time': '2017-05-15 21:30:00',
        'Departure scheduled time': '2017-05-15 00:00:00',
        'Arrival scheduled time': '2017-05-15 21:30:00',
        Cancelled: 'FALSE',
      },
    ]);

    const flight = (await processLogMyTripFile(content, options)).flights[0]!;

    expect(flight.departure).toBeNull();
    expect(flight.arrival).toBe('2017-05-15T19:30:00.000+00:00');
    expect(flight.departureScheduled).toBeNull();
    expect(flight.arrivalScheduled).toBe('2017-05-15T19:30:00.000+00:00');
  });

  it('parses airport names that contain parentheses', async () => {
    const content = toCsv([
      {
        'Operated as': 'VG191',
        'Departure airport':
          'Antwerp International Airport (Deurne) (ANR/EBAW)',
        'Arrival airport': BUD,
        'Departure time': '2009-11-03 07:15:00',
        Cancelled: 'FALSE',
      },
    ]);

    const result = await processLogMyTripFile(content, options);

    expect(getAirportByIcao).toHaveBeenCalledWith('EBAW');
    expect(result.flights[0]?.from).toMatchObject({ icao: 'EBAW' });
  });

  it('reports unknown airports and applies mappings', async () => {
    const content = toCsv([
      {
        'Operated as': 'FR199',
        'Departure airport': BUD,
        'Arrival airport': 'Berlin-Schönefeld International Airport (SXF/)',
        'Departure time': '2015-11-22 16:55:00',
        Cancelled: 'FALSE',
      },
    ]);

    const unresolved = await processLogMyTripFile(content, options);
    expect(unresolved.flights[0]?.to).toBeNull();
    expect(unresolved.unknowns.airports).toEqual({ SXF: [0] });
    expect(getAirportByIata).toHaveBeenCalledWith('SXF');

    const mapped = {
      id: 99,
      iata: 'BER',
      icao: 'EDDB',
      tz: 'Europe/Berlin',
    } as never;
    const resolved = await processLogMyTripFile(content, {
      ...options,
      airportMapping: { SXF: mapped },
    });
    expect(resolved.flights[0]?.to).toEqual(mapped);
    expect(resolved.unknowns.airports).toEqual({});
  });

  it('keeps scheduled times for a diverted flight', async () => {
    const content = toCsv([
      {
        'Operated as': 'EW7751',
        'Departure airport': VIE,
        'Arrival airport': 'Hannover Airport (HAJ/EDDV)',
        'Arrival scheduled airport': 'Hamburg Airport (HAM/EDDH)',
        'Departure time': '2019-07-28 23:59:00',
        'Arrival time': '2019-07-29 01:01:00',
        'Departure scheduled time': '2019-07-28 20:00:00',
        'Arrival scheduled time': '2019-07-28 21:35:00',
        Duration: '62',
        Cancelled: 'FALSE',
      },
    ]);

    const flight = (await processLogMyTripFile(content, options)).flights[0]!;

    expect(flight.departure).toBe('2019-07-28T21:59:00.000+00:00');
    expect(flight.arrival).toBe('2019-07-28T23:01:00.000+00:00');
    expect(flight.departureScheduled).toBe('2019-07-28T18:00:00.000+00:00');
    expect(flight.arrivalScheduled).toBe('2019-07-28T19:35:00.000+00:00');
    expect(flight.note).toBe('Diverted (planned arrival: Hamburg Airport)');
  });
});
