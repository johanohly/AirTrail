import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAircraftPhoto } from './aircraft-photos';

const { getConfig, checkRequest } = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    integrations: { aircraftPhotosEnabled: true },
  })),
  checkRequest: vi.fn(),
}));

vi.mock('$lib/server/utils/config', () => ({
  appConfig: { get: getConfig },
}));

vi.mock('$lib/utils/ratelimiter', () => ({
  RequestRateLimiter: class {
    checkRequest = checkRequest;
  },
}));

const photoPayload = (overrides: Record<string, unknown> = {}) => ({
  photos: [
    {
      thumbnail: { src: 'https://t.plnspttrs.net/thumb.jpg', size: '400x267' },
      thumbnail_large: {
        src: 'https://t.plnspttrs.net/large.jpg',
        size: '1200x800',
      },
      link: 'https://www.planespotters.net/photo/123/aircraft?utm_source=api',
      photographer: 'Jane Doe',
      ...overrides,
    },
  ],
});

// Module-level cache persists across tests — use a unique registration per test.
describe('getAircraftPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockResolvedValue({
      integrations: { aircraftPhotosEnabled: true },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null without fetching when the integration is disabled', async () => {
    getConfig.mockResolvedValue({
      integrations: { aircraftPhotosEnabled: false },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getAircraftPhoto('DISABLED1');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prefers thumbnail_large over thumbnail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(photoPayload())),
    );

    const result = await getAircraftPhoto('PREFLARGE');

    expect(result?.thumbnailSrc).toBe('https://t.plnspttrs.net/large.jpg');
    expect(result?.link).toBe(
      'https://www.planespotters.net/photo/123/aircraft?utm_source=api',
    );
    expect(result?.photographer).toBe('Jane Doe');
  });

  it('falls back to thumbnail when thumbnail_large is missing', async () => {
    const payload = photoPayload();
    delete (payload.photos[0] as Record<string, unknown>).thumbnail_large;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(payload)),
    );

    const result = await getAircraftPhoto('FALLBACK1');

    expect(result?.thumbnailSrc).toBe('https://t.plnspttrs.net/thumb.jpg');
  });

  it('treats an empty photos array as no photo', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ photos: [] })),
    );

    const result = await getAircraftPhoto('NOPHOTO1');

    expect(result).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns null and logs when the fetch fails', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    );

    const result = await getAircraftPhoto('ERRORREG');

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('sends a descriptive user agent with a contact url', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ photos: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftPhoto('UACHECK1');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.planespotters.net/pub/photos/reg/UACHECK1');
    const headers = init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(
      'AirTrail (+https://github.com/johanohly/AirTrail)',
    );
    expect(headers.Accept).toBe('application/json');
  });

  it('looks up registrations case-insensitively', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ photos: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftPhoto('  da40xl  ');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.planespotters.net/pub/photos/reg/DA40XL',
    );
  });

  it('caches a successful lookup', async () => {
    const fetchMock = vi.fn(async () => Response.json(photoPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftPhoto('CACHED01');
    const second = await getAircraftPhoto('CACHED01');

    expect(second?.photographer).toBe('Jane Doe');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches when bypassCache is set', async () => {
    const fetchMock = vi.fn(async () => Response.json(photoPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await getAircraftPhoto('BYPASS01');
    await getAircraftPhoto('BYPASS01', { bypassCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
