import { addDays, format, subDays } from 'date-fns';
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
  it('getFlightRoute looks up the day before and after an actual departure date', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json([]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const date = subDays(new Date(), 10);

    await expect(
      getFlightRoute('CI22', { date, dateKind: 'actual' }),
    ).rejects.toThrow('No matching flights found');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://aerodatabox.p.rapidapi.com/flights/number/CI22/${format(subDays(date, 1), 'yyyy-MM-dd')}/${format(addDays(date, 1), 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`,
    );
  });

  it('getFlightRoute keeps a single-date lookup for a scheduled date', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json([]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const date = subDays(new Date(), 10);

    await expect(
      getFlightRoute('CI22', { date, dateKind: 'scheduled' }),
    ).rejects.toThrow('No matching flights found');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://aerodatabox.p.rapidapi.com/flights/number/CI22/${format(date, 'yyyy-MM-dd')}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`,
    );
  });

  it('getFlightRoute returns every flight around an actual departure date', async () => {
    const instance = (day: number) => ({
      departure: {
        airport: { icao: 'RCTP', timeZone: 'Asia/Taipei' },
        scheduledTime: { local: `2026-11-${day} 23:35+08:00` },
      },
      arrival: {
        airport: { icao: 'KSEA', timeZone: 'America/Los_Angeles' },
        scheduledTime: { local: `2026-11-${day} 18:10-08:00` },
      },
    });
    const delayed = instance(14);
    Object.assign(delayed.departure, {
      revisedTime: { local: '2026-11-15 00:22+08:00' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json([delayed, instance(15), instance(16)])),
    );

    const results = await getFlightRoute('CI22', {
      date: subDays(new Date(), 10),
      dateKind: 'actual',
    });

    expect(results.map((r) => r.departureScheduled?.getTime())).toEqual([
      Date.parse('2026-11-14T15:35:00.000Z'),
      Date.parse('2026-11-15T15:35:00.000Z'),
      Date.parse('2026-11-16T15:35:00.000Z'),
    ]);
    expect(results[0]?.departure?.getTime()).toBe(
      Date.parse('2026-11-14T16:22:00.000Z'),
    );
  });
});
