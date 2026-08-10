import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAircraftFromReg } from './aerodatabox';

const { getAircraftByIcao, getConfig, checkRequest } = vi.hoisted(() => ({
  getAircraftByIcao: vi.fn(),
  getConfig: vi.fn(async () => ({
    integrations: { aeroDataBoxKey: 'test-api-key' },
  })),
  checkRequest: vi.fn(),
}));

vi.mock('$lib/server/utils/aircraft', () => ({
  getAircraftByIcao,
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
