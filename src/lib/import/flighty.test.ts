import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processFlightyFile } from './flighty';

const { getAirportByIata, getAircraftByName } = vi.hoisted(() => ({
  getAirportByIata: vi.fn(async (iata: string) => ({
    id: iata,
    iata,
    tz: 'UTC',
  })),
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
}));

vi.mock('$lib/utils/data/airlines', () => ({
  getAirlineByIata: vi.fn(),
  getAirlineByIcao: vi.fn(),
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByName,
}));

const createFlightyCsv = (aircraftName: string) => {
  const headers = [
    'From',
    'To',
    'Gate Departure (Actual)',
    'Gate Departure (Scheduled)',
    'Gate Arrival (Actual)',
    'Gate Arrival (Scheduled)',
    'Take off (Scheduled)',
    'Take off (Actual)',
    'Landing (Scheduled)',
    'Landing (Actual)',
    'Dep Terminal',
    'Dep Gate',
    'Arr Terminal',
    'Arr Gate',
    'PNR',
    'Canceled',
    'Diverted To',
    'Airline',
    'Flight',
    'Seat Type',
    'Seat',
    'Cabin Class',
    'Flight Reason',
    'Tail Number',
    'Aircraft Type Name',
    'Notes',
  ];
  const values = [
    'CPH',
    'LHR',
    '',
    '2025-01-01T10:00',
    '',
    '2025-01-01T12:00',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'false',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    aircraftName,
    '',
  ];

  return `${headers.join(',')}\n${values.join(',')}`;
};

describe('processFlightyFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports and applies mappings for unknown Flighty aircraft names', async () => {
    const content = createFlightyCsv('Boeing 737-900ER');
    const options = {
      filterOwner: false,
      airlineFromFlightNumber: false,
      importMode: 'personal' as const,
    };

    const unresolved = await processFlightyFile(content, options);

    expect(unresolved.flights).toHaveLength(1);
    expect(unresolved.flights[0]?.aircraft).toBeNull();
    expect(unresolved.unknowns.aircraft).toEqual({
      'Boeing 737-900ER': [0],
    });
    expect(getAircraftByName).toHaveBeenCalledWith('Boeing 737-900ER');

    const mappedAircraft = {
      id: 7,
      name: 'Boeing 737-900',
      icao: 'B739',
      sourceId: 'boeing-737-900',
    };
    const resolved = await processFlightyFile(content, {
      ...options,
      aircraftMapping: {
        'Boeing 737-900ER': mappedAircraft,
      },
    });

    expect(resolved.flights[0]?.aircraft).toEqual(mappedAircraft);
    expect(resolved.unknowns.aircraft).toEqual({});
    expect(getAircraftByName).toHaveBeenCalledTimes(1);
  });
});
