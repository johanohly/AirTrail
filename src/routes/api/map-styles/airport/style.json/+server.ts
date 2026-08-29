import type { RequestHandler } from './$types';

import {
  getArcgisWorldImageryStyle,
  normalizeMapBasemap,
  normalizeMapTheme,
} from '$lib/map/basemap';
import { buildAirportStyle } from '$lib/map/airport-style';
import {
  getLocalFallbackStyle,
  loadProviderStyle,
} from '$lib/server/map/basemap-style';
import { appConfig } from '$lib/server/utils/config';

export const GET: RequestHandler = async ({ fetch, url }) => {
  const theme = normalizeMapTheme(url.searchParams.get('theme'));
  const basemap = normalizeMapBasemap(url.searchParams.get('basemap'));

  if (basemap === 'satellite') {
    return Response.json(getArcgisWorldImageryStyle(), {
      headers: {
        'cache-control': 'private, max-age=300, stale-while-revalidate=3600',
        'x-airtrail-basemap-provider': 'arcgis',
      },
    });
  }

  const config = (await appConfig.get())?.map;
  if (!config) {
    return Response.json(
      { message: 'Map configuration is unavailable.' },
      { status: 503 },
    );
  }

  let provider = config.provider;
  let fallbackProvider: string | null = null;
  let resolved: Awaited<ReturnType<typeof loadProviderStyle>>;

  try {
    resolved = await loadProviderStyle({
      config,
      fetchFn: fetch,
      requestOrigin: url.origin,
      theme,
    });
  } catch (error) {
    console.warn('Configured basemap provider failed', {
      provider,
      reason: error instanceof Error ? error.name : 'UnknownError',
    });

    if (provider !== 'openfreemap') {
      try {
        fallbackProvider = 'openfreemap';
        resolved = await loadProviderStyle({
          config,
          fetchFn: fetch,
          provider: 'openfreemap',
          requestOrigin: url.origin,
          theme,
        });
        provider = 'openfreemap';
      } catch {
        resolved = {
          style: getLocalFallbackStyle(theme),
          fonts: {
            regular: ['Noto Sans Regular'],
            emphasis: ['Noto Sans Regular'],
          },
          creditsOpenStreetMap: false,
          provider: 'local',
        };
        fallbackProvider = 'local';
      }
    } else {
      resolved = {
        style: getLocalFallbackStyle(theme),
        fonts: {
          regular: ['Noto Sans Regular'],
          emphasis: ['Noto Sans Regular'],
        },
        creditsOpenStreetMap: false,
        provider: 'local',
      };
      fallbackProvider = 'local';
    }
  }

  const style = buildAirportStyle(resolved.style, {
    theme,
    fonts: resolved.fonts,
    creditsOpenStreetMap: resolved.creditsOpenStreetMap,
    provider: resolved.provider,
  });
  const headers: Record<string, string> = {
    'cache-control': 'private, max-age=300, stale-while-revalidate=3600',
    'x-airtrail-basemap-provider': provider,
  };
  if (fallbackProvider) {
    headers['x-airtrail-basemap-fallback'] = fallbackProvider;
  }

  return Response.json(style, { headers });
};
