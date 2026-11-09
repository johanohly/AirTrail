import { format, subDays } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAircraftFromReg, getFlightRoute } from './aerodatabox';

const {
  getAircraftByIcao,
  getAirportByIcao,
  getAirlineByIcao,
  getAirlineByIata,
  getConfig,
  checkRequest,
} = vi.hoisted(() => ({
  getAircraftByIcao: vi.fn(),
  getAirportByIcao: vi.fn(),
  getAirlineByIcao: vi.fn(),
  getAirlineByIata: vi.fn(),
  getConfig: vi.fn(async () => ({
    integrations: {
      aeroDataBoxKey: 'test-api-key',
      aeroDataBoxEndpoint: 'rapidapi' as 'rapidapi' | 'direct',
    },
  })),
  checkRequest: vi.fn(),
}));

vi.mock('$lib/server/utils/aircraft', () => ({
  getAircraftByIcao,
}));

vi.mock('$lib/server/utils/airport', () => ({
  getAirportByIcao,
}));

vi.mock('$lib/server/utils/airline', () => ({
  getAirlineByIcao,
  getAirlineByIata,
}));

vi.mock('$lib/server/utils/config', () => ({
  appConfig: { get: getConfig },
}));

vi.mock('$lib/utils/ratelimiter', () => ({
  RequestRateLimiter: class {
    checkRequest = checkRequest;
  },
}));

describe('getAircraftFromReg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAircraftByIcao.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers the precise model code over the generic ICAO code', async () => {
    const aircraft = { id: 'aircraft-b773', icao: 'B773' };
    getAircraftByIcao.mockResolvedValueOnce(aircraft);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ model: 'B773', icaoCode: 'B777' })),
    );

    await expect(getAircraftFromReg('B-16712')).resolves.toBe(aircraft);
    expect(getAircraftByIcao).toHaveBeenCalledTimes(1);
    expect(getAircraftByIcao).toHaveBeenCalledWith('B773');
  });

  it('falls back to the generic ICAO code when the model is unknown', async () => {
    const aircraft = { id: 'aircraft-b777', icao: 'B777' };
    getAircraftByIcao
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(aircraft);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ model: 'B773', icaoCode: 'B777' })),
    );

    await expect(getAircraftFromReg('B-16712')).resolves.toBe(aircraft);
    expect(getAircraftByIcao).toHaveBeenNthCalledWith(1, 'B773');
    expect(getAircraftByIcao).toHaveBeenNthCalledWith(2, 'B777');
  });

  it('uses the model when the response has no generic ICAO code', async () => {
    const aircraft = { id: 'aircraft-a359', icao: 'A359' };
    getAircraftByIcao.mockResolvedValueOnce(aircraft);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ model: 'A359' })),
    );

    await expect(getAircraftFromReg('D-AIXD')).resolves.toBe(aircraft);
    expect(getAircraftByIcao).toHaveBeenCalledWith('A359');
  });

  it('returns null when neither aircraft code resolves', async () => {
    getAircraftByIcao.mockResolvedValue(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ model: 'UNKNOWN', icaoCode: 'GENERIC' }),
      ),
    );

    await expect(getAircraftFromReg('UNKNOWN')).resolves.toBeNull();
    expect(getAircraftByIcao).toHaveBeenNthCalledWith(1, 'UNKNOWN');
    expect(getAircraftByIcao).toHaveBeenNthCalledWith(2, 'GENERIC');
  });

  it('returns null without a lookup when the response has no codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    );

    await expect(getAircraftFromReg('UNKNOWN')).resolves.toBeNull();
    expect(getAircraftByIcao).not.toHaveBeenCalled();
  });
});

describe('endpoint selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockResolvedValue({
      integrations: {
        aeroDataBoxKey: 'test-api-key',
        aeroDataBoxEndpoint: 'rapidapi',
      },
    });
    getAirportByIcao.mockResolvedValue({
      id: 1,
      icao: 'EKCH',
      iata: 'CPH',
      lat: 0,
      lon: 0,
      tz: 'UTC',
      name: 'EKCH',
      municipality: null,
      type: 'large_airport',
      continent: 'EU',
      country: 'DK',
      custom: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getAircraftFromReg uses the RapidAPI gateway by default', async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftFromReg('D-AIXD');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://aerodatabox.p.rapidapi.com/aircrafts/reg/D-AIXD',
      { headers: { 'x-rapidapi-key': 'test-api-key' } },
    );
  });

  it('getAircraftFromReg uses the Direct gateway when configured', async () => {
    getConfig.mockResolvedValue({
      integrations: {
        aeroDataBoxKey: 'test-api-key',
        aeroDataBoxEndpoint: 'direct',
      },
    });
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftFromReg('D-AIXD');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.aerodatabox.com/aircrafts/reg/D-AIXD',
      { headers: { 'X-Api-Key': 'test-api-key' } },
    );
  });

  it('getFlightRoute uses the RapidAPI gateway and date-range URL when no date is given', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json([]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFlightRoute('SK728')).rejects.toThrow(
      'No matching flights found',
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain(
      'https://aerodatabox.p.rapidapi.com/flights/number/SK728/',
    );
    // The platform defines these params on the single-date endpoint only.
    expect(url).not.toContain('withAircraftImage');
    expect(url).not.toContain('withLocation');
    expect(init).toEqual({ headers: { 'x-rapidapi-key': 'test-api-key' } });
  });

  it('getFlightRoute uses the Direct gateway and single-date URL when a date is given', async () => {
    getConfig.mockResolvedValue({
      integrations: {
        aeroDataBoxKey: 'test-api-key',
        aeroDataBoxEndpoint: 'direct',
      },
    });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json([]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const date = subDays(new Date(), 10);

    await expect(getFlightRoute('SK728', { date })).rejects.toThrow(
      'No matching flights found',
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://api.aerodatabox.com/flights/number/SK728/${format(date, 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`,
    );
    expect(init).toEqual({ headers: { 'X-Api-Key': 'test-api-key' } });
  });
});

describe('getFlightRoute movement times', () => {
  const utc = (iso: string) => Date.parse(iso);

  const airport = (icao: string, tzId: string) => ({
    id: 1,
    icao,
    iata: icao,
    lat: 0,
    lon: 0,
    tz: tzId,
    name: icao,
    municipality: null,
    type: 'large_airport',
    continent: 'EU',
    country: 'DK',
    custom: false,
  });

  const mockAirports = (depTz: string, arrTz: string) => {
    getAirportByIcao.mockImplementation(async (icao: string) =>
      icao === 'EKCH' ? airport('EKCH', depTz) : airport('LFPG', arrTz),
    );
  };

  // Departure in Copenhagen (+02:00 in June), arrival in New York (-04:00), so
  // every delta must be computed on instants rather than local wall times.
  const flight = (
    departure: Record<string, unknown>,
    arrival: Record<string, unknown>,
  ) => ({
    departure: {
      airport: { icao: 'EKCH', timeZone: 'Europe/Copenhagen' },
      ...departure,
    },
    arrival: {
      airport: { icao: 'LFPG', timeZone: 'America/New_York' },
      ...arrival,
    },
  });

  const lookup = async (body: unknown) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );
    const result = await getFlightRoute('SK728');
    return result[0]!;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockResolvedValue({
      integrations: {
        aeroDataBoxKey: 'test-api-key',
        aeroDataBoxEndpoint: 'rapidapi',
      },
    });
    mockAirports('Europe/Copenhagen', 'America/New_York');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets actual from revisedTime and leaves runway and derived values null when only revisedTime exists', async () => {
    const result = await lookup([
      flight(
        { revisedTime: { utc: '2026-06-15T08:05:00Z' } },
        { revisedTime: { utc: '2026-06-15T11:45:00Z' } },
      ),
    ]);

    expect(result.departure?.getTime()).toBe(utc('2026-06-15T08:05:00Z'));
    expect(result.departure?.timeZone).toBe('Europe/Copenhagen');
    expect(result.arrival?.getTime()).toBe(utc('2026-06-15T11:45:00Z'));
    expect(result.arrival?.timeZone).toBe('America/New_York');
    expect(result.departureRunway).toBeNull();
    expect(result.arrivalRunway).toBeNull();
    expect(result.taxiOut).toBeNull();
    expect(result.taxiIn).toBeNull();
    expect(result.airborneTime).toBeNull();
  });

  it('derives taxi and airborne minutes from runway times across timezones', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: { utc: '2026-06-15T08:05:00Z' },
          runwayTime: { utc: '2026-06-15T08:22:00Z' },
        },
        {
          revisedTime: { utc: '2026-06-15T11:45:00Z' },
          runwayTime: { utc: '2026-06-15T11:32:00Z' },
        },
      ),
    ]);

    expect(result.departureRunway?.getTime()).toBe(utc('2026-06-15T08:22:00Z'));
    expect(result.departureRunway?.timeZone).toBe('Europe/Copenhagen');
    expect(result.arrivalRunway?.getTime()).toBe(utc('2026-06-15T11:32:00Z'));
    expect(result.arrivalRunway?.timeZone).toBe('America/New_York');
    expect(result.taxiOut).toBe(17);
    expect(result.taxiIn).toBe(13);
    expect(result.airborneTime).toBe(190);
  });

  it('suppresses derived values when runwayTime equals revisedTime', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: { utc: '2026-06-15T08:05:00Z' },
          runwayTime: { utc: '2026-06-15T08:05:00Z' },
        },
        {
          revisedTime: { utc: '2026-06-15T11:45:00Z' },
          runwayTime: { utc: '2026-06-15T11:45:00Z' },
        },
      ),
    ]);

    expect(result.departure?.getTime()).toBe(utc('2026-06-15T08:05:00Z'));
    expect(result.taxiOut).toBeNull();
    expect(result.taxiIn).toBeNull();
    expect(result.airborneTime).toBeNull();
  });

  it('rejects a negative taxi-out time', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: { utc: '2026-06-15T08:05:00Z' },
          runwayTime: { utc: '2026-06-15T07:50:00Z' },
        },
        { revisedTime: { utc: '2026-06-15T11:45:00Z' } },
      ),
    ]);

    expect(result.taxiOut).toBeNull();
    expect(result.taxiIn).toBeNull();
    expect(result.airborneTime).toBeNull();
  });

  it('rejects an implausible airborne time', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: { utc: '2026-06-15T08:05:00Z' },
          runwayTime: { utc: '2026-06-15T08:22:00Z' },
        },
        {
          revisedTime: { utc: '2026-06-16T09:40:00Z' },
          runwayTime: { utc: '2026-06-16T09:32:00Z' },
        },
      ),
    ]);

    // 25h 10m between wheels off and touchdown.
    expect(result.airborneTime).toBeNull();
    expect(result.taxiOut).toBe(17);
    expect(result.taxiIn).toBe(8);
  });

  it('never uses predictedTime', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: { utc: '2026-06-15T08:05:00Z' },
          predictedTime: { utc: '2026-06-15T12:00:00Z' },
        },
        {
          revisedTime: { utc: '2026-06-15T11:45:00Z' },
          predictedTime: { utc: '2026-06-15T18:00:00Z' },
        },
      ),
    ]);

    expect(result.departure?.getTime()).toBe(utc('2026-06-15T08:05:00Z'));
    expect(result.arrival?.getTime()).toBe(utc('2026-06-15T11:45:00Z'));
  });

  it('parses the utc and local members of a time to the same instant', async () => {
    const result = await lookup([
      flight(
        {
          revisedTime: {
            utc: '2026-03-08T00:30:00Z',
            local: '2026-03-08 01:30+01:00',
          },
        },
        {
          revisedTime: {
            utc: '2026-03-08T04:00:00Z',
            local: '2026-03-08 00:00-04:00',
          },
        },
      ),
    ]);

    expect(result.departure?.getTime()).toBe(utc('2026-03-08T00:30:00Z'));
    expect(result.departure?.timeZone).toBe('Europe/Copenhagen');
    expect(result.arrival?.getTime()).toBe(utc('2026-03-08T04:00:00Z'));
    expect(result.arrival?.timeZone).toBe('America/New_York');
  });

  it('falls back to scheduledTime and derives nothing when revisedTime is absent', async () => {
    const result = await lookup([
      flight(
        {
          scheduledTime: { utc: '2026-06-15T08:00:00Z' },
          runwayTime: { utc: '2026-06-15T08:22:00Z' },
        },
        { scheduledTime: { utc: '2026-06-15T11:30:00Z' } },
      ),
    ]);

    expect(result.departure?.getTime()).toBe(utc('2026-06-15T08:00:00Z'));
    expect(result.departureRunway?.getTime()).toBe(utc('2026-06-15T08:22:00Z'));
    expect(result.taxiOut).toBeNull();
    expect(result.taxiIn).toBeNull();
    expect(result.airborneTime).toBeNull();
  });
});
