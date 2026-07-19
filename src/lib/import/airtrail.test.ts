import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processAirTrailFile } from './airtrail';

const {
  getAirportByIcao,
  getAirlineByIcao,
  getAirlineByName,
  getAircraftByIcao,
  getAircraftByName,
  userListQuery,
  currentUser,
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
  currentUser: {
    id: 'local-user',
    username: 'john',
    role: 'user',
  },
}));

vi.mock('$app/state', () => ({
  page: {
    data: {
      user: currentUser,
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
  importMode: 'personal' as const,
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
  passengers: [seat],
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
    Object.assign(currentUser, {
      id: 'local-user',
      username: 'john',
      role: 'user',
    });
    userListQuery.mockResolvedValue([
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
    ]);
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
    expect(flight.passengers).toEqual([
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

  it('limits personal imports to the selected exported account', async () => {
    const otherUser = {
      id: 'export-other',
      username: 'jane',
      displayName: 'Jane Export',
    };
    userListQuery.mockResolvedValue([
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
      {
        id: 'local-other',
        username: 'jane',
        displayName: 'Jane Local',
      },
    ]);

    const content = JSON.stringify({
      users: [...exportedUsers, otherUser],
      flights: [
        {
          ...flightBase,
          from: airportObject('EKCH'),
          to: airportObject('EIDW'),
          airline: null,
          aircraft: null,
          passengers: [
            seat,
            {
              ...seat,
              userId: otherUser.id,
              seatNumber: '12B',
            },
          ],
        },
        {
          ...flightBase,
          flightNumber: 'SK456',
          from: airportObject('EIDW'),
          to: airportObject('EKCH'),
          airline: null,
          aircraft: null,
          passengers: [{ ...seat, userId: otherUser.id }],
        },
      ],
    });

    const result = await processAirTrailFile(content, {
      ...baseOptions,
      userMapping: { 'export-user': 'local-user' },
    });

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.passengers).toEqual([
      { ...seat, userId: 'local-user' },
      {
        ...seat,
        userId: null,
        guestName: 'Jane Export',
        seatNumber: '12B',
      },
    ]);
  });

  it('restores mapped passengers without adding the importing admin', async () => {
    Object.assign(currentUser, {
      id: 'import-admin',
      username: 'admin',
      role: 'admin',
    });
    userListQuery.mockResolvedValue([
      {
        id: 'import-admin',
        username: 'admin',
        displayName: 'Import Admin',
      },
      {
        id: 'local-user',
        username: 'john',
        displayName: 'John Local',
      },
    ]);

    const content = JSON.stringify({
      users: exportedUsers,
      flights: [
        {
          ...flightBase,
          from: airportObject('EKCH'),
          to: airportObject('EIDW'),
          airline: null,
          aircraft: null,
        },
      ],
    });

    const result = await processAirTrailFile(content, {
      ...baseOptions,
      importMode: 'restore',
      userMapping: { 'export-user': 'local-user' },
    });

    expect(result.flights[0]?.passengers).toEqual([
      { ...seat, userId: 'local-user' },
    ]);
    expect(result.flights[0]?.passengers).not.toContainEqual(
      expect.objectContaining({ userId: 'import-admin' }),
    );
  });

  it('treats an explicit empty restore mapping as guest passengers', async () => {
    const content = JSON.stringify({
      users: exportedUsers,
      flights: [
        {
          ...flightBase,
          from: airportObject('EKCH'),
          to: airportObject('EIDW'),
          airline: null,
          aircraft: null,
        },
      ],
    });

    const result = await processAirTrailFile(content, {
      ...baseOptions,
      importMode: 'restore',
      userMapping: {},
    });

    expect(result.flights[0]?.passengers).toEqual([
      { ...seat, userId: null, guestName: 'John Export' },
    ]);
  });
});
