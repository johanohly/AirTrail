export type CartoTheme = 'light' | 'dark';

export const CARTO_POSITRON_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
export const CARTO_DARK_MATTER_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const normalizeCartoTheme = (theme: string): CartoTheme =>
  theme === 'dark' ? 'dark' : 'light';

export const getCartoBasemapStyleUrl = (theme: string) =>
  normalizeCartoTheme(theme) === 'dark'
    ? CARTO_DARK_MATTER_STYLE_URL
    : CARTO_POSITRON_STYLE_URL;
