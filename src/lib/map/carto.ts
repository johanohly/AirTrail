export type CartoTheme = 'light' | 'dark';

export const CARTO_POSITRON_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
export const CARTO_DARK_MATTER_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_LIGHT_RASTER_TILE_URL =
  'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
const CARTO_DARK_RASTER_TILE_URL =
  'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const CARTO_GLYPHS_URL =
  'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf';

export const normalizeCartoTheme = (theme?: string): CartoTheme =>
  theme === 'dark' ? 'dark' : 'light';

export const getCartoBasemapStyleUrl = (theme: string) =>
  normalizeCartoTheme(theme) === 'dark'
    ? CARTO_DARK_MATTER_STYLE_URL
    : CARTO_POSITRON_STYLE_URL;

export const getCartoFallbackBasemapStyle = (theme: string) => {
  const normalizedTheme = normalizeCartoTheme(theme);
  const isDark = normalizedTheme === 'dark';

  return {
    version: 8,
    name: isDark ? 'Carto Dark Matter Fallback' : 'Carto Positron Fallback',
    glyphs: CARTO_GLYPHS_URL,
    sources: {
      'carto-raster': {
        type: 'raster',
        tiles: [
          isDark ? CARTO_DARK_RASTER_TILE_URL : CARTO_LIGHT_RASTER_TILE_URL,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto-raster',
        type: 'raster',
        source: 'carto-raster',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
};
