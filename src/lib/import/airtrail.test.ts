import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processAirTrailFile } from './airtrail';

const {
  getAirportByIcao,
  getAirlineByIcao,
  getAirlineByName,
  getAircraftByIcao,
  getAircraftByName,
  userListQuery,
} = vi.hoisted(() => ({
  getAirportByIcao: vi.fn(async (icao: string) => ({
    id: 1,
    icao,
    tz: 'UTC',
  })),
  getAirlineByIcao: vi.fn(async (icao: string) => ({
    id: 2,
    icao,
    name: `${icao} Airways`,
  })),
  getAirlineByName: vi.fn(async (name: string) => ({
    id: 3,
    icao: null,
    name,
  })),
  getAircraftByIcao: vi.fn(async (icao: string) => ({
    id: 4,
    icao,
    name: `${icao} Aircraft`,
  })),
  getAircraftByName: vi.fn(async (name: string) => ({
    id: 5,
    icao: null,
    name,
  })),
  userListQuery: vi.fn(async () => [
    {
      id: 'local-user',
      username: 'john',
      displayName: 'John Local',
    },
  ]),
}));

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: {
        id: 'local-user',
        username: 'john',
      },
    },
  },
}));

vi.mock('$lib/trpc', () => ({
  api: {
    user: {
      list: {
        query: userListQuery,
      },
    },
  },
}));

vi.mock('$lib/utils/data/airports/cache', () => ({
  getAirportByIcao,
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIcao,
  getAirlineByName,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao,
  getAircraftByName,
}));

const baseOptions = {
  filterOwner: false,
  airlineFromFlightNumber: false,
};

const exportedUsers = [
  {
    id: 'export-user',
    username: 'john',
    displayName: 'John Export',
  },
];

const seat = {
  userId: 'export-user',
  guestName: null,
  seat: 'window',
  seatNumber: '12A',
  seatClass: 'economy',
};

const flightBase = {
  date: '2024-06-14',
  departure: '2024-06-14T10:00:00.000Z',
  arrival: '2024-06-14T12:00:00.000Z',
  duration: 7200,
  flightNumber: 'SK123',
  aircraftReg: null,
  flightReason: 'leisure',
  note: null,
  seats: [seat],
};

const airportObject = (icao: string, id?: number) => ({
  ...(id ? { id } : {}),
  type: 'large_airport',
  name: `${icao} Airport`,
  municipality: null,
  lat: 55.0,
  lon: 12.0,
  continent: 'EU',
  country: 'DK',
  icao,
  iata: null,
  tz: 'UTC',
  custom: false,
});

describe('processAirTrailFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports later v3 JSON exports with nested airport, airline, and aircraft objects', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      flights: [
        {
          ...flightBase,
          datePrecision: 'month',
          from: airportObject('EKCH'),
          to: airportObject('EIDW'),
          airline: {
            name: 'Scandinavian Airlines',
            icao: 'SAS',
            iata: 'SK',
          },
          aircraft: {
            name: 'Airbus A320neo',
            icao: 'A20N',
          },
          departureScheduled: '2024-06-14T09:45:00.000Z',
          arrivalScheduled: null,
          takeoffScheduled: null,
          takeoffActual: null,
          landingScheduled: null,
          landingActual: '2024-06-14T11:58:00.000Z',
        },
      ],
    });

    const result = await processAirTrailFile(content, baseOptions);

    expect(result.flights).toHaveLength(1);
    expect(result.unknownAirports).toEqual({});
    expect(result.unknownAirlines).toEqual({});
    expect(getAirportByIcao).toHaveBeenCalledWith('EKCH');
    expect(getAirportByIcao).toHaveBeenCalledWith('EIDW');
    expect(getAirlineByIcao).toHaveBeenCalledWith('SAS');
    expect(getAircraftByIcao).toHaveBeenCalledWith('A20N');

    const flight = result.flights[0]!;
    expect(flight.datePrecision).toBe('month');
    expect(flight.departureScheduled).toBe('2024-06-14T09:45:00.000Z');
    expect(flight.landingActual).toBe('2024-06-14T11:58:00.000Z');
    expect(flight.seats).toEqual([
      {
        ...seat,
        userId: 'local-user',
      },
    ]);
  });

  it('imports v3.0 JSON exports with nested database IDs and no timetable fields', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      flights: [
        {
          ...flightBase,
          fromId: 10,
          toId: 11,
          airlineId: 12,
          aircraftId: 13,
          from: airportObject('EKCH', 10),
          to: airportObject('EIDW', 11),
          airline: {
            id: 12,
            name: 'Scandinavian Airlines',
            icao: 'SAS',
            iata: 'SK',
          },
          aircraft: {
            id: 13,
            name: 'Airbus A320neo',
            icao: 'A20N',
          },
        },
      ],
    });

    const result = await processAirTrailFile(content, baseOptions);

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.from).toMatchObject({ icao: 'EKCH' });
    expect(result.flights[0]?.to).toMatchObject({ icao: 'EIDW' });
    expect(result.flights[0]?.datePrecision).toBe('day');
    expect(result.flights[0]?.departureScheduled).toBeNull();
    expect(result.flights[0]?.arrivalScheduled).toBeNull();
    expect(result.flights[0]?.takeoffScheduled).toBeNull();
    expect(result.flights[0]?.takeoffActual).toBeNull();
    expect(result.flights[0]?.landingScheduled).toBeNull();
    expect(result.flights[0]?.landingActual).toBeNull();
  });

  it('falls back to names when nested airline or aircraft objects have no ICAO code', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      flights: [
        {
          ...flightBase,
          from: airportObject('EKCH'),
          to: airportObject('EIDW'),
          airline: {
            name: 'Private Operator',
            icao: null,
            iata: null,
          },
          aircraft: {
            name: 'Unknown Aircraft',
            icao: null,
          },
        },
      ],
    });

    const result = await processAirTrailFile(content, baseOptions);

    expect(result.flights).toHaveLength(1);
    expect(getAirlineByName).toHaveBeenCalledWith('Private Operator');
    expect(getAircraftByName).toHaveBeenCalledWith('Unknown Aircraft');
    expect(result.flights[0]?.airline).toMatchObject({
      name: 'Private Operator',
    });
    expect(result.flights[0]?.aircraft).toMatchObject({
      name: 'Unknown Aircraft',
    });
  });
});
