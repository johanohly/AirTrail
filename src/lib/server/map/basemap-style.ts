import { layers, namedFlavor } from '@protomaps/basemaps';
import { z } from 'zod';

import type { MapProvider, MapTheme } from '$lib/map/basemap';
import type {
  AirportStyleFonts,
  AirportStyleProvider,
} from '$lib/map/airport-style';
import type { MapConfig } from '$lib/zod/config';

const OPENFREEMAP_STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} satisfies Record<MapTheme, string>;

const CARTO_STYLE_URLS = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} satisfies Record<MapTheme, string>;

const PROTOMAPS_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PROTOMAPS_HOSTED_ATTRIBUTION =
  '&copy; <a href="https://protomaps.com">Protomaps</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PROVIDER_FONTS = {
  openfreemap: {
    regular: ['Noto Sans Regular'],
    emphasis: ['Noto Sans Bold'],
  },
  carto: {
    regular: ['Montserrat Regular', 'Open Sans Regular', 'Noto Sans Regular'],
    emphasis: ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Bold'],
  },
  protomaps: {
    regular: ['Noto Sans Regular'],
    emphasis: ['Noto Sans Medium'],
  },
} satisfies Record<MapProvider, AirportStyleFonts>;

const styleSchema = z
  .object({
    version: z.literal(8),
    sources: z.record(z.string(), z.object({}).loose()),
    layers: z.array(z.object({ id: z.string(), type: z.string() }).loose()),
  })
  .loose();

const tileJsonSchema = z
  .object({
    tiles: z.array(z.string().url()).min(1),
    attribution: z.string().optional(),
    minzoom: z.number().optional(),
    maxzoom: z.number().optional(),
    bounds: z.array(z.number()).length(4).optional(),
  })
  .loose();

type StyleDocument = z.infer<typeof styleSchema>;

type ResolvedProviderStyle = {
  style: StyleDocument;
  fonts: AirportStyleFonts;
  creditsOpenStreetMap: boolean;
  provider: AirportStyleProvider;
};

type CachedStyle = {
  value: StyleDocument;
  expiresAt: number;
  lastUsedAt: number;
};

const STYLE_TTL_MS = 60 * 60 * 1000;
const STALE_STYLE_RETRY_MS = 60 * 1000;
const STYLE_FETCH_TIMEOUT_MS = 8_000;
const MAX_CACHED_STYLES = 12;
const styleCache = new Map<string, CachedStyle>();
const styleRequests = new Map<string, Promise<StyleDocument>>();

const pruneStyleCache = () => {
  if (styleCache.size <= MAX_CACHED_STYLES) return;

  const oldest = [...styleCache.entries()].sort(
    ([, first], [, second]) => first.lastUsedAt - second.lastUsedAt,
  )[0];
  if (oldest) styleCache.delete(oldest[0]);
};

const appendApiKey = (value: string, apiKey: string) => {
  const url = new URL(value);
  url.searchParams.set('key', apiKey);
  return url.toString().replaceAll('%7B', '{').replaceAll('%7D', '}');
};

const fetchJson = async (
  fetchFn: typeof fetch,
  url: string,
): Promise<unknown> => {
  const response = await fetchFn(url, {
    signal: AbortSignal.timeout(STYLE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Basemap request failed with status ${response.status}`);
  }
  return response.json();
};

const fetchRemoteStyle = async ({
  cacheKey,
  fetchFn,
  url,
}: {
  cacheKey: string;
  fetchFn: typeof fetch;
  url: string;
}) => {
  const now = Date.now();
  const cached = styleCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    cached.lastUsedAt = now;
    return structuredClone(cached.value);
  }

  const inFlight = styleRequests.get(cacheKey);
  if (inFlight) return structuredClone(await inFlight);

  const request = (async () => {
    try {
      const style = styleSchema.parse(await fetchJson(fetchFn, url));
      styleCache.set(cacheKey, {
        value: style,
        expiresAt: Date.now() + STYLE_TTL_MS,
        lastUsedAt: Date.now(),
      });
      pruneStyleCache();
      return style;
    } catch (error) {
      if (cached) {
        const now = Date.now();
        cached.expiresAt = now + STALE_STYLE_RETRY_MS;
        cached.lastUsedAt = now;
        return cached.value;
      }
      throw error;
    }
  })();

  styleRequests.set(cacheKey, request);
  try {
    return structuredClone(await request);
  } finally {
    styleRequests.delete(cacheKey);
  }
};

const signCartoStyle = async (
  style: StyleDocument,
  apiKey: string,
  fetchFn: typeof fetch,
) => {
  const signed = structuredClone(style);

  if (typeof signed.glyphs === 'string') {
    signed.glyphs = appendApiKey(signed.glyphs, apiKey);
  }
  if (typeof signed.sprite === 'string') {
    signed.sprite = appendApiKey(signed.sprite, apiKey);
  }

  for (const [sourceId, sourceValue] of Object.entries(signed.sources)) {
    if (
      !sourceValue ||
      typeof sourceValue !== 'object' ||
      Array.isArray(sourceValue)
    ) {
      continue;
    }

    const source = sourceValue;
    if (Array.isArray(source.tiles)) {
      source.tiles = source.tiles.map((tile) =>
        typeof tile === 'string' && tile.includes('cartocdn.com')
          ? appendApiKey(tile, apiKey)
          : tile,
      );
    }

    if (
      typeof source.url !== 'string' ||
      !source.url.includes('cartocdn.com')
    ) {
      continue;
    }

    const tileJson = tileJsonSchema.parse(
      await fetchJson(fetchFn, appendApiKey(source.url, apiKey)),
    );
    const { url: _url, ...sourceWithoutUrl } = source;
    signed.sources[sourceId] = {
      ...sourceWithoutUrl,
      tiles: tileJson.tiles.map((tile) => appendApiKey(tile, apiKey)),
      ...(tileJson.attribution ? { attribution: tileJson.attribution } : {}),
      ...(tileJson.minzoom !== undefined ? { minzoom: tileJson.minzoom } : {}),
      ...(tileJson.maxzoom !== undefined ? { maxzoom: tileJson.maxzoom } : {}),
      ...(tileJson.bounds ? { bounds: tileJson.bounds } : {}),
    };
  }

  return signed;
};

const buildProtomapsStyle = (
  config: MapConfig,
  theme: MapTheme,
  requestOrigin: string,
): StyleDocument => {
  const sourceUrl = config.protomapsSourceUrl ?? '';
  const assetsBaseUrl = new URL(config.protomapsAssetsBaseUrl, requestOrigin)
    .toString()
    .replace(/\/+$/, '');
  let source: Record<string, unknown>;

  switch (config.protomapsSourceKind) {
    case 'hosted':
      source = {
        type: 'vector',
        url: appendApiKey(
          'https://api.protomaps.com/tiles/v4.json',
          config.protomapsApiKey ?? '',
        ),
        attribution: PROTOMAPS_HOSTED_ATTRIBUTION,
      };
      break;
    case 'pmtiles':
      source = {
        type: 'vector',
        url: sourceUrl.startsWith('pmtiles://')
          ? sourceUrl
          : `pmtiles://${sourceUrl}`,
        attribution: PROTOMAPS_ATTRIBUTION,
      };
      break;
    case 'tilejson':
      source = {
        type: 'vector',
        url: sourceUrl,
        attribution: PROTOMAPS_ATTRIBUTION,
      };
      break;
    case 'zxy':
      source = {
        type: 'vector',
        tiles: [sourceUrl],
        maxzoom: config.protomapsMaxZoom,
        attribution: PROTOMAPS_ATTRIBUTION,
      };
      break;
    default: {
      const exhaustive: never = config.protomapsSourceKind;
      throw new Error(`Unsupported Protomaps source: ${exhaustive}`);
    }
  }

  return styleSchema.parse({
    version: 8,
    name: `AirTrail Protomaps (${theme})`,
    glyphs: `${assetsBaseUrl}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsBaseUrl}/sprites/v4/${theme}`,
    sources: { protomaps: source },
    layers: layers('protomaps', namedFlavor(theme), {
      lang: config.protomapsLanguage,
    }),
  });
};

const inlineHostedProtomapsSource = async (
  style: StyleDocument,
  apiKey: string,
  fetchFn: typeof fetch,
) => {
  const tileJson = tileJsonSchema.parse(
    await fetchJson(
      fetchFn,
      appendApiKey('https://api.protomaps.com/tiles/v4.json', apiKey),
    ),
  );
  style.sources.protomaps = {
    type: 'vector',
    tiles: tileJson.tiles.map((tile) => appendApiKey(tile, apiKey)),
    attribution: PROTOMAPS_HOSTED_ATTRIBUTION,
    ...(tileJson.minzoom !== undefined ? { minzoom: tileJson.minzoom } : {}),
    ...(tileJson.maxzoom !== undefined ? { maxzoom: tileJson.maxzoom } : {}),
    ...(tileJson.bounds ? { bounds: tileJson.bounds } : {}),
  };

  return style;
};

export const getMapProviderConfigurationIssue = (
  config: MapConfig,
): string | null => {
  if (config.provider === 'carto' && !config.cartoApiKey) {
    return 'CARTO requires an API key.';
  }
  if (config.provider !== 'protomaps') return null;

  if (config.protomapsSourceKind === 'hosted' && !config.protomapsApiKey) {
    return 'The Protomaps hosted API requires an API key.';
  }
  if (config.protomapsSourceKind !== 'hosted' && !config.protomapsSourceUrl) {
    return 'The selected Protomaps source requires a URL.';
  }
  if (
    config.protomapsSourceKind === 'zxy' &&
    config.protomapsSourceUrl &&
    !['{z}', '{x}', '{y}'].every((token) =>
      config.protomapsSourceUrl?.includes(token),
    )
  ) {
    return 'A ZXY URL must contain {z}, {x}, and {y} placeholders.';
  }
  return null;
};

export const loadProviderStyle = async ({
  config,
  fetchFn,
  provider = config.provider,
  requestOrigin,
  theme,
}: {
  config: MapConfig;
  fetchFn: typeof fetch;
  provider?: MapProvider;
  requestOrigin: string;
  theme: MapTheme;
}): Promise<ResolvedProviderStyle> => {
  switch (provider) {
    case 'openfreemap':
      return {
        style: await fetchRemoteStyle({
          cacheKey: `openfreemap:${theme}`,
          fetchFn,
          url: OPENFREEMAP_STYLE_URLS[theme],
        }),
        fonts: PROVIDER_FONTS.openfreemap,
        creditsOpenStreetMap: true,
        provider,
      };
    case 'carto': {
      if (!config.cartoApiKey) throw new Error('CARTO API key is missing');
      const style = await fetchRemoteStyle({
        cacheKey: `carto:${theme}`,
        fetchFn,
        url: appendApiKey(CARTO_STYLE_URLS[theme], config.cartoApiKey),
      });
      return {
        style: await signCartoStyle(style, config.cartoApiKey, fetchFn),
        fonts: PROVIDER_FONTS.carto,
        creditsOpenStreetMap: true,
        provider,
      };
    }
    case 'protomaps': {
      const configurationIssue = getMapProviderConfigurationIssue(config);
      if (configurationIssue) throw new Error(configurationIssue);
      const style = buildProtomapsStyle(config, theme, requestOrigin);
      const resolvedStyle =
        config.protomapsSourceKind === 'hosted'
          ? await inlineHostedProtomapsSource(
              style,
              config.protomapsApiKey ?? '',
              fetchFn,
            )
          : style;
      return {
        style: resolvedStyle,
        fonts: PROVIDER_FONTS.protomaps,
        creditsOpenStreetMap: true,
        provider,
      };
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported map provider: ${exhaustive}`);
    }
  }
};

export const getLocalFallbackStyle = (theme: MapTheme): StyleDocument =>
  styleSchema.parse({
    version: 8,
    name: 'AirTrail local fallback',
    sources: {},
    layers: [
      {
        id: 'airtrail-background',
        type: 'background',
        paint: {
          'background-color': theme === 'dark' ? '#111827' : '#eef1f5',
        },
      },
    ],
  });
