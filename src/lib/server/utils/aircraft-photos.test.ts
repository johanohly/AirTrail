import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getConfig, isPublicDemo } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  isPublicDemo: vi.fn(() => false),
}));

vi.mock('$lib/server/utils/config', () => ({
  appConfig: { get: getConfig },
}));

vi.mock('$lib/server/demo/mode', () => ({ isPublicDemo }));

const HOUR_MS = 60 * 60 * 1000;
const PHOTO_TTL_MS = 24 * HOUR_MS - 10 * 60 * 1000;

const photoResponse = () =>
  Response.json({
    photos: [
      {
        thumbnail: { src: 'https://t.plnspttrs.net/thumb.jpg' },
        thumbnail_large: { src: 'https://t.plnspttrs.net/large.jpg' },
        link: 'https://www.planespotters.net/photo/1/a?utm_source=api',
        photographer: 'Jane Doe',
      },
    ],
  });

const FOUND = {
  status: 'found',
  photo: {
    thumbnailSrc: 'https://t.plnspttrs.net/large.jpg',
    link: 'https://www.planespotters.net/photo/1/a?utm_source=api',
    photographer: 'Jane Doe',
  },
};

describe('getAircraftPhoto', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let getAircraftPhoto: typeof import('./aircraft-photos').getAircraftPhoto;

  // A settled lookup claims a request slot, so step past it between calls.
  const nextSlot = () => vi.advanceTimersByTimeAsync(1000);

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    isPublicDemo.mockReturnValue(false);
    getConfig.mockResolvedValue({
      integrations: { aircraftPhotosEnabled: true },
    });
    fetchMock = vi.fn(async () => photoResponse());
    vi.stubGlobal('fetch', fetchMock);
    ({ getAircraftPhoto } = await import('./aircraft-photos'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports disabled without fetching when the integration is off', async () => {
    getConfig.mockResolvedValue({
      integrations: { aircraftPhotosEnabled: false },
    });

    expect(await getAircraftPhoto('HB-JNA')).toEqual({ status: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports disabled without fetching in a public demo', async () => {
    isPublicDemo.mockReturnValue(true);

    expect(await getAircraftPhoto('HB-JNA')).toEqual({ status: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the photo and identifies itself to Planespotters', async () => {
    expect(await getAircraftPhoto(' hb-jna ')).toEqual(FOUND);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.planespotters.net/pub/photos/reg/HB-JNA');
    expect(init.headers['User-Agent']).toContain('AirTrail');
  });

  it('falls back to the small thumbnail', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        photos: [
          {
            thumbnail: { src: 'https://t.plnspttrs.net/thumb.jpg' },
            link: 'https://www.planespotters.net/photo/1/a',
            photographer: 'Jane Doe',
          },
        ],
      }),
    );

    expect(await getAircraftPhoto('HB-JNA')).toMatchObject({
      photo: { thumbnailSrc: 'https://t.plnspttrs.net/thumb.jpg' },
    });
  });

  it('reports no photo for an empty response and caches it for an hour', async () => {
    fetchMock.mockImplementation(async () => Response.json({ photos: [] }));

    expect(await getAircraftPhoto('HB-JNA')).toEqual({ status: 'none' });

    await vi.advanceTimersByTimeAsync(HOUR_MS - 1000);
    expect(await getAircraftPhoto('HB-JNA')).toEqual({ status: 'none' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await getAircraftPhoto('HB-JNA');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not send something that cannot be a registration upstream', async () => {
    expect(await getAircraftPhoto('../admin')).toEqual({ status: 'none' });
    expect(await getAircraftPhoto('')).toEqual({ status: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', async () => new Response('', { status: 500 })],
    [
      'a network failure',
      async () => {
        throw new TypeError('fetch failed');
      },
    ],
    ['an unexpected body', async () => Response.json({ nope: true })],
    [
      'a non-HTTPS link',
      async () =>
        Response.json({
          photos: [
            {
              thumbnail: { src: 'https://t.plnspttrs.net/thumb.jpg' },
              link: 'javascript:alert(1)',
              photographer: 'Jane Doe',
            },
          ],
        }),
    ],
  ])('does not cache %s as no photo', async (_, failure) => {
    fetchMock.mockImplementationOnce(failure);

    expect(await getAircraftPhoto('HB-JNA')).toEqual({ status: 'unavailable' });

    await nextSlot();
    expect(await getAircraftPhoto('HB-JNA')).toEqual(FOUND);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops serving a photo early enough for the browser to stay within 24 hours', async () => {
    await getAircraftPhoto('HB-JNA');

    await vi.advanceTimersByTimeAsync(PHOTO_TTL_MS - 1000);
    await getAircraftPhoto('hb-jna');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await getAircraftPhoto('HB-JNA');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops an expired photo on the next call, even with the integration off', async () => {
    await getAircraftPhoto('HB-JNA');
    getConfig.mockResolvedValue({
      integrations: { aircraftPhotosEnabled: false },
    });
    await vi.advanceTimersByTimeAsync(PHOTO_TTL_MS);
    const deleted = vi.spyOn(Map.prototype, 'delete');

    await getAircraftPhoto('D-AIMA');

    expect(deleted).toHaveBeenCalledWith('HB-JNA');
  });

  it('shares one request between parallel lookups of a registration', async () => {
    const results = await Promise.all([
      getAircraftPhoto('HB-JNA'),
      getAircraftPhoto('HB-JNA'),
    ]);

    expect(results).toEqual([FOUND, FOUND]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('spaces parallel lookups of different registrations a second apart', async () => {
    const lookups = Promise.all([
      getAircraftPhoto('HB-JNA'),
      getAircraftPhoto('HB-JNB'),
      getAircraftPhoto('HB-JNC'),
    ]);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await lookups;
  });

  it('turns callers away instead of queueing without limit', async () => {
    const lookups = Promise.all(
      Array.from({ length: 12 }, (_, i) => getAircraftPhoto(`HB-J${i}0`)),
    );

    await vi.advanceTimersByTimeAsync(20_000);

    const results = await lookups;
    expect(fetchMock.mock.calls.length).toBeLessThan(12);
    expect(results.at(-1)).toEqual({ status: 'unavailable' });
  });

  describe('when rate limited', () => {
    const rateLimited = (retryAfter?: string) =>
      new Response('', {
        status: 429,
        headers: retryAfter ? { 'Retry-After': retryAfter } : {},
      });

    it('pauses other lookups for as long as Retry-After says', async () => {
      fetchMock.mockResolvedValueOnce(rateLimited('120'));

      expect(await getAircraftPhoto('HB-JNA')).toEqual({
        status: 'unavailable',
      });

      await vi.advanceTimersByTimeAsync(119_000);
      expect(await getAircraftPhoto('HB-JNB')).toEqual({
        status: 'unavailable',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(await getAircraftPhoto('HB-JNA')).toEqual(FOUND);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('understands a Retry-After date', async () => {
      fetchMock.mockResolvedValueOnce(
        rateLimited(new Date(Date.now() + 120_000).toUTCString()),
      );
      await getAircraftPhoto('HB-JNA');

      await vi.advanceTimersByTimeAsync(110_000);
      await getAircraftPhoto('HB-JNB');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10_000);
      await getAircraftPhoto('HB-JNB');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['is missing', undefined],
      ['is garbage', 'soon'],
    ])('pauses for a minute when Retry-After %s', async (_, retryAfter) => {
      fetchMock.mockResolvedValueOnce(rateLimited(retryAfter));
      await getAircraftPhoto('HB-JNA');

      await vi.advanceTimersByTimeAsync(59_000);
      await getAircraftPhoto('HB-JNB');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      await getAircraftPhoto('HB-JNB');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('caps a very long Retry-After at an hour', async () => {
      fetchMock.mockResolvedValueOnce(rateLimited('999999'));
      await getAircraftPhoto('HB-JNA');

      await vi.advanceTimersByTimeAsync(HOUR_MS);
      await getAircraftPhoto('HB-JNB');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stops callers already waiting in line', async () => {
      fetchMock.mockResolvedValueOnce(rateLimited('60'));

      const results = Promise.all([
        getAircraftPhoto('HB-JNA'),
        getAircraftPhoto('HB-JNB'),
        getAircraftPhoto('HB-JNC'),
      ]);
      await vi.advanceTimersByTimeAsync(5000);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await results).toEqual([
        { status: 'unavailable' },
        { status: 'unavailable' },
        { status: 'unavailable' },
      ]);
    });

    it('does not cache a 429 as no photo', async () => {
      fetchMock.mockResolvedValueOnce(rateLimited('1'));
      await getAircraftPhoto('HB-JNA');

      await nextSlot();
      expect(await getAircraftPhoto('HB-JNA')).toEqual(FOUND);
    });
  });
});
