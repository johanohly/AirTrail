import {
  AIRPORT_STYLE_ROUTE_PATH,
  getAirportGatePillImageId,
} from '$lib/map/airport-style';
import { normalizeCartoTheme } from '$lib/map/carto';
import type { CustomImageSpec } from 'svelte-maplibre';

type AppMapConfig = {
  lightStyleUrl?: string | null;
  darkStyleUrl?: string | null;
};

export const getDefaultAppMapStyleUrl = (theme: string) => {
  const normalizedTheme = normalizeCartoTheme(theme);
  return `${AIRPORT_STYLE_ROUTE_PATH}?theme=${normalizedTheme}`;
};

export const getConfiguredAppMapStyleUrl = (
  theme: string,
  config?: AppMapConfig | null,
) => {
  const normalizedTheme = normalizeCartoTheme(theme);

  if (normalizedTheme === 'dark') {
    return config?.darkStyleUrl || getDefaultAppMapStyleUrl(normalizedTheme);
  }

  return config?.lightStyleUrl || getDefaultAppMapStyleUrl(normalizedTheme);
};

export const getAppMapImages = (base = ''): CustomImageSpec[] => {
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
  ];
};
