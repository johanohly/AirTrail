import type { RequestHandler } from './$types';

import { getCartoBasemapStyleUrl, normalizeCartoTheme } from '$lib/map/carto';
import { buildPmtilesAirportStyle } from '$lib/map/airport-style';

const BASE_STYLE_TTL_MS = 60 * 60 * 1000;

type CachedBaseStyle = {
  value: Record<string, unknown>;
  expiresAt: number;
};

const baseStyleCache = new Map<string, CachedBaseStyle>();
const baseStyleRequests = new Map<string, Promise<Record<string, unknown>>>();

const fetchBaseStyle = async (fetchFn: typeof fetch, url: string) => {
  const now = Date.now();
  const cached = baseStyleCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = baseStyleRequests.get(url);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new Response(null, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const value = (await response.json()) as Record<string, unknown>;
    baseStyleCache.set(url, {
      value,
      expiresAt: Date.now() + BASE_STYLE_TTL_MS,
    });

    return value;
  })();

  baseStyleRequests.set(url, request);

  try {
    return await request;
  } finally {
    baseStyleRequests.delete(url);
  }
};

export const GET: RequestHandler = async ({ fetch, url }) => {
  const theme = normalizeCartoTheme(url.searchParams.get('theme') ?? 'light');
  const baseStyleUrl = getCartoBasemapStyleUrl(theme);

  try {
    const baseStyle = await fetchBaseStyle(fetch, baseStyleUrl);
    const style = buildPmtilesAirportStyle(baseStyle, theme);

    return Response.json(style, {
      headers: {
        'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }
};
