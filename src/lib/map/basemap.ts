export type MapBasemap = 'default' | 'satellite';

export const MAP_THEMES = ['light', 'dark'] as const;
export type MapTheme = (typeof MAP_THEMES)[number];

export const MAP_PROVIDERS = ['openfreemap', 'carto', 'protomaps'] as const;
export type MapProvider = (typeof MAP_PROVIDERS)[number];

export const PROTOMAPS_SOURCE_KINDS = [
  'hosted',
  'pmtiles',
  'tilejson',
  'zxy',
] as const;
export type ProtomapsSourceKind = (typeof PROTOMAPS_SOURCE_KINDS)[number];

export const MAP_BASEMAPS: readonly MapBasemap[] = ['default', 'satellite'];

export const ARCGIS_WORLD_IMAGERY_SERVICE_URL =
  'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer';

export const normalizeMapBasemap = (basemap: string | null): MapBasemap =>
  basemap === 'satellite' ? 'satellite' : 'default';

export const normalizeMapTheme = (theme?: string | null): MapTheme =>
  theme === 'dark' ? 'dark' : 'light';

export const getArcgisWorldImageryStyle = () => ({
  version: 8,
  name: 'Airport Style (Satellite)',
  sources: {
    'arcgis-world-imagery': {
      type: 'raster',
      tiles: [`${ARCGIS_WORLD_IMAGERY_SERVICE_URL}/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 23,
      attribution:
        'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    {
      id: 'arcgis-world-imagery',
      type: 'raster',
      source: 'arcgis-world-imagery',
      minzoom: 0,
      maxzoom: 23,
    },
  ],
});
