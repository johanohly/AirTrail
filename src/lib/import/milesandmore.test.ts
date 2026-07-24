import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processMilesAndMoreFile } from './milesandmore';

const { getAirportByIata, getAirlineByIata, getAircraftByIcao } = vi.hoisted(
  () => ({
    getAirportByIata: vi.fn(async (iata: string) => ({
      id: iata,
      iata,
      tz: 'UTC',
    })),
    getAirlineByIata: vi.fn(async (iata: string) => ({ id: iata, iata })),
    getAircraftByIcao: vi.fn(async (icao: string) => ({ id: icao, icao })),
  }),
);

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
  getAirlineByIata,
}));

vi.mock('$lib/utils/data/aircraft', () => ({
  getAircraftByIcao,
}));

const baseSegment = {
  DepartureDate: '2025-03-01',
  ArrivalDate: '2025-03-01',
  OriginCityCode: 'ZRH  ',
  OriginCityName: 'Zurich',
  DestinationCityCode: 'BER  ',
  DestinationCityName: 'Berlin',
  OriginAirportCode: 'ZRH',
  OriginAirportName: 'Zurich Airport',
  DestinationAirportCode: 'BER',
  DestinationAirportName: 'Berlin Brandenburg Apt',
  StatusPoints: 20,
  GupPoints: 0,
  HonPoints: 0,
  AirlineDesignatorCode: 'LX   ',
  FlightNumber: 962,
  CompartmentClass: 'M',
  AircraftCode: '320  ',
  Distance: 405,
  TimeOnPlane: 5100,
  StatusMiles: 0,
  AwardMiles: 552,
  DepartureTime: '2025-03-01T19:55:00.000+0000',
  ArrivalTime: '2025-03-01T21:20:00.000+0000',
  Honmiles: 0,
  PnrrecordLocator: 'ABC123',
};

const fileWith = (segments: Record<string, unknown>[]) =>
  JSON.stringify({ SegmentListResponses: segments });

const defaultOptions = {
  filterOwner: false,
  airlineFromFlightNumber: false,
  importMode: 'personal' as const,
};

describe('processMilesAndMoreFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports a normal segment', async () => {
    const result = await processMilesAndMoreFile(
      fileWith([baseSegment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    const flight = result.flights[0]!;
    expect(flight.date).toBe('2025-03-01');
    expect(flight.datePrecision).toBe('day');
    expect(flight.flightNumber).toBe('LX962');
    expect(flight.duration).toBe(5100);
    expect(flight.departure).toBe('2025-03-01T19:55:00.000Z');
    expect(flight.arrival).toBe('2025-03-01T21:20:00.000Z');
    expect(getAirportByIata).toHaveBeenCalledWith('ZRH');
    expect(getAirportByIata).toHaveBeenCalledWith('BER');
    expect(getAirlineByIata).toHaveBeenCalledWith('LX');
    expect(getAircraftByIcao).toHaveBeenCalledWith('A320');
    expect(flight.passengers[0]?.seatClass).toBe('economy');
    expect(flight.note).toBe(
      'Miles & More: PNR ABC123, 552 award miles, 20 status points',
    );
    expect(result.skippedRows).toBe(0);
  });

  it('trims whitespace-padded fixed-width fields', async () => {
    const result = await processMilesAndMoreFile(
      fileWith([baseSegment]),
      defaultOptions,
    );

    expect(getAirlineByIata).toHaveBeenCalledWith('LX');
    expect(getAircraftByIcao).toHaveBeenCalledWith('A320');
    expect(result.flights[0]?.flightNumber).toBe('LX962');
  });

  it('handles a missing aircraft code gracefully', async () => {
    const segment = { ...baseSegment, AircraftCode: null };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.aircraft).toBeNull();
    expect(getAircraftByIcao).not.toHaveBeenCalled();
  });

  it('warns and leaves aircraft unset for unmapped IATA type codes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segment = { ...baseSegment, AircraftCode: 'ZZZ' };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights[0]?.aircraft).toBeNull();
    expect(getAircraftByIcao).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unmapped aircraft type code "ZZZ"'),
    );
    warnSpy.mockRestore();
  });

  it('handles missing departure/arrival times as date-only', async () => {
    const segment = {
      ...baseSegment,
      DepartureTime: null,
      ArrivalTime: null,
    };
    delete (segment as Record<string, unknown>).DepartureTime;
    delete (segment as Record<string, unknown>).ArrivalTime;

    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.departure).toBeNull();
    expect(result.flights[0]?.arrival).toBeNull();
    expect(result.flights[0]?.date).toBe('2025-03-01');
  });

  it('drops exact times when arrival precedes departure, but keeps the flight', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segment = {
      ...baseSegment,
      DepartureTime: '2025-03-01T21:20:00.000+0000',
      ArrivalTime: '2025-03-01T19:55:00.000+0000',
    };

    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]?.departure).toBeNull();
    expect(result.flights[0]?.arrival).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('arrival before departure'),
    );
    warnSpy.mockRestore();
  });

  it('reports unknown airport codes', async () => {
    getAirportByIata.mockImplementationOnce(async () => null);
    const result = await processMilesAndMoreFile(
      fileWith([baseSegment]),
      defaultOptions,
    );

    expect(result.unknowns.airports.ZRH).toEqual([0]);
  });

  it('reports unknown airline codes', async () => {
    getAirlineByIata.mockResolvedValueOnce(null);
    const result = await processMilesAndMoreFile(
      fileWith([baseSegment]),
      defaultOptions,
    );

    expect(result.unknowns.airlines.LX).toEqual([0]);
  });

  it('reports unknown aircraft type codes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segment = { ...baseSegment, AircraftCode: 'ZZZ' };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.unknowns.aircraft.ZZZ).toEqual([0]);
    warnSpy.mockRestore();
  });

  it.each([
    ['290', 'E290'],
    ['295', 'E295'],
  ])(
    'maps Embraer E2 IATA code %s to ICAO %s, not the first-gen E-Jet code',
    async (aircraftCode, icaoCode) => {
      const segment = { ...baseSegment, AircraftCode: aircraftCode };
      await processMilesAndMoreFile(fileWith([segment]), defaultOptions);

      expect(getAircraftByIcao).toHaveBeenCalledWith(icaoCode);
    },
  );

  it.each(['757', '767', '787'])(
    'leaves ambiguous generic aircraft code %s unmapped',
    async (aircraftCode) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const segment = { ...baseSegment, AircraftCode: aircraftCode };
      const result = await processMilesAndMoreFile(
        fileWith([segment]),
        defaultOptions,
      );

      expect(result.flights[0]?.aircraft).toBeNull();
      expect(getAircraftByIcao).not.toHaveBeenCalled();
      expect(result.unknowns.aircraft[aircraftCode]).toEqual([0]);
      warnSpy.mockRestore();
    },
  );

  it('uses aircraftMapping overrides instead of the static IATA table', async () => {
    const mappedAircraft = { id: 'mapped', icao: 'A320' };
    const result = await processMilesAndMoreFile(fileWith([baseSegment]), {
      ...defaultOptions,
      aircraftMapping: { '320': mappedAircraft as never },
    });

    expect(result.flights[0]?.aircraft).toBe(mappedAircraft);
    expect(getAircraftByIcao).not.toHaveBeenCalled();
  });

  it.each([
    ['F', 'first'],
    ['C', 'business'],
    ['P', 'business'],
    ['M', 'economy'],
    ['Y', 'economy'],
    ['E', 'economy+'],
    ['W', 'economy+'],
    ['G', 'economy+'],
    ['N', 'economy+'],
  ])('maps compartment class %s to %s', async (compartmentClass, expected) => {
    const segment = { ...baseSegment, CompartmentClass: compartmentClass };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights[0]?.passengers[0]?.seatClass).toBe(expected);
  });

  it('warns and leaves seat class unset for unknown compartment class codes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segment = { ...baseSegment, CompartmentClass: 'X' };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights[0]?.passengers[0]?.seatClass).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown compartment class code "X"'),
    );
    warnSpy.mockRestore();
  });

  it('skips segments missing an origin or destination code', async () => {
    const segment = { ...baseSegment, OriginAirportCode: '' };
    const result = await processMilesAndMoreFile(
      fileWith([segment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });

  it('skips a segment with the origin code entirely absent without rejecting the whole file', async () => {
    const incompleteSegment = { ...baseSegment };
    delete (incompleteSegment as Record<string, unknown>).OriginAirportCode;

    const result = await processMilesAndMoreFile(
      fileWith([incompleteSegment, baseSegment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it('skips a segment with the airline designator code entirely absent without rejecting the whole file', async () => {
    const incompleteSegment = { ...baseSegment };
    delete (incompleteSegment as Record<string, unknown>).AirlineDesignatorCode;

    const result = await processMilesAndMoreFile(
      fileWith([incompleteSegment, baseSegment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it('skips a segment with the flight number entirely absent without rejecting the whole file', async () => {
    const incompleteSegment = { ...baseSegment };
    delete (incompleteSegment as Record<string, unknown>).FlightNumber;

    const result = await processMilesAndMoreFile(
      fileWith([incompleteSegment, baseSegment]),
      defaultOptions,
    );

    expect(result.flights).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it('rejects invalid JSON', async () => {
    await expect(
      processMilesAndMoreFile('not json', defaultOptions),
    ).rejects.toThrow('Invalid JSON');
  });

  it('rejects a payload missing SegmentListResponses', async () => {
    await expect(
      processMilesAndMoreFile(JSON.stringify({ foo: 'bar' }), defaultOptions),
    ).rejects.toThrow();
  });
});
