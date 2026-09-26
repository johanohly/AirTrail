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
