import {
  AIRPORT_STYLE_ROUTE_PATH,
  getAirportGatePillImageId,
} from '$lib/map/airport-style';
import { normalizeCartoTheme } from '$lib/map/carto';
import {
  getOpenAipPatternImages,
  getOpenAipSymbolImages,
} from '$lib/map/openaip';
import type { CustomImageSpec } from 'svelte-maplibre';
import type { MapBasemap } from './basemap';

type AppMapConfig = {
  lightStyleUrl?: string | null;
  darkStyleUrl?: string | null;
};

export const getDefaultAppMapStyleUrl = (
  theme: string,
  basemap: MapBasemap = 'default',
) => {
  const normalizedTheme = normalizeCartoTheme(theme);
  if (basemap === 'satellite') {
    return `${AIRPORT_STYLE_ROUTE_PATH}?theme=${normalizedTheme}&basemap=satellite`;
  }

  return `${AIRPORT_STYLE_ROUTE_PATH}?theme=${normalizedTheme}`;
};

export const getConfiguredAppMapStyleUrl = (
  theme: string,
  config?: AppMapConfig | null,
  basemap: MapBasemap = 'default',
) => {
  const normalizedTheme = normalizeCartoTheme(theme);
  if (basemap === 'satellite') {
    return getDefaultAppMapStyleUrl(normalizedTheme, basemap);
  }

  if (normalizedTheme === 'dark') {
    return config?.darkStyleUrl || getDefaultAppMapStyleUrl(normalizedTheme);
  }

  return config?.lightStyleUrl || getDefaultAppMapStyleUrl(normalizedTheme);
};

export const getAppMapImages = (
  base = '',
  theme = 'light',
): CustomImageSpec[] => {
  const normalizedTheme = normalizeCartoTheme(theme);

  return [
    {
      id: getAirportGatePillImageId('light'),
      url: `${base}/airport-style/gate-pill-light@2x.png`,
      options: {
        pixelRatio: 2,
      },
    },
    {
      id: getAirportGatePillImageId('dark'),
      url: `${base}/airport-style/gate-pill-dark@2x.png`,
      options: {
        pixelRatio: 2,
      },
    },
    ...['white', 'blue', 'gray', 'green', 'red', 'yellow'].map((color) => ({
      id: `chevron-${color}`,
      url: `${base}/airport-style/chevron-${color}@2x.png`,
      options: { pixelRatio: 2 },
    })),
    {
      id: 'papi',
      url: `${base}/airport-style/papi@2x.png`,
      options: { pixelRatio: 2 },
    },
    {
      id: 'windsock',
      url: `${base}/airport-style/windsock@2x.png`,
      options: { pixelRatio: 2 },
    },
    {
      id: 'tower',
      url: `${base}/airport-style/tower@2x.png`,
      options: { pixelRatio: 2 },
    },
    ...getOpenAipPatternImages(),
    ...getOpenAipSymbolImages(normalizedTheme),
  ];
};
