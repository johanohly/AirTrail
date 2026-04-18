import { normalizeCartoTheme } from '$lib/map/carto';

export const AIRPORT_STYLE_ROUTE_PATH = '/api/map-styles/airport/style.json';
export const getAirportGatePillImageId = (theme: string) =>
  normalizeCartoTheme(theme) === 'dark'
    ? 'airport-gate-pill-dark'
    : 'airport-gate-pill-light';

const AIRPORT_SOURCE = 'airport-overlay';
const AIRPORT_FILL = '#ededed';
const AIRPORT_FILL_DARK = '#e4e4e4';
const AIRPORT_OUTLINE = '#d0d0d0';
const AIRPORT_TERMINAL = '#f1f1f1';
const AIRPORT_TERMINAL_SHADOW = '#c8c8c8';
const AIRPORT_TERMINAL_SHADOW_OPACITY = 0.68;
const AIRPORT_TERMINAL_SHADOW_OFFSET_Z13: [number, number] = [1.25, 1.25];
const AIRPORT_TERMINAL_SHADOW_OFFSET_Z15: [number, number] = [3.25, 3.25];
const AIRPORT_TERMINAL_LABEL_SIZE_Z13 = 11.75;
const AIRPORT_TERMINAL_LABEL_SIZE_Z16 = 15.25;
const AIRPORT_LABEL = '#666666';
const AIRPORT_LABEL_STRONG = '#4f4f4f';
const AIRPORT_HALO = '#ffffff';
const AIRPORT_NAME = '#5a5a5a';
const DARK_AIRPORT_PAINT_OVERRIDES = {
  'airport-overlay-taxiway-outline': {
    'line-color': '#2f3640',
  },
  'airport-overlay-taxiway-line': {
    'line-color': '#4d5663',
  },
  'airport-overlay-apron': {
    'fill-color': '#4d5663',
  },
  'airport-overlay-apron-outline': {
    'line-color': '#2f3640',
  },
  'airport-overlay-runway-outline': {
    'line-color': '#2f3640',
  },
  'airport-overlay-runway-line': {
    'line-color': '#596271',
  },
  'airport-overlay-terminals-shadow': {
    'fill-color': '#0c0f14',
    'fill-opacity': 0.5,
  },
  'airport-overlay-terminals': {
    'fill-color': '#707a87',
  },
  'airport-overlay-jetbridge-shadow': {
    'line-color': '#0c0f14',
    'line-opacity': 0.5,
  },
  'airport-overlay-jetbridge': {
    'line-color': '#707a87',
  },
  'airport-overlay-name-label': {
    'text-color': '#f5f7fa',
    'text-halo-color': '#0b0e13',
  },
  'airport-overlay-terminal-labels': {
    'text-color': '#edf2f7',
    'text-halo-color': '#0b0e13',
  },
  'airport-overlay-taxiway-labels': {
    'text-color': '#d4d9e0',
    'text-halo-color': '#0b0e13',
  },
  'airport-overlay-runway-labels': {
    'text-color': '#edf2f7',
    'text-halo-color': '#0b0e13',
  },
  'airport-overlay-gate-label': {
    'text-color': '#111111',
  },
} as const;
const DARK_AIRPORT_LAYOUT_OVERRIDES = {
  'airport-overlay-gate-label': {
    'text-font': ['Roboto Bold'],
  },
} as const;
const RUNWAY_WIDTH_VALUE = [
  'to-number',
  [
    'coalesce',
    ['get', 'width'],
    ['*', ['to-number', ['get', 'width_m']], 3.28084],
  ],
] as const;

const terminalFilter = [
  'any',
  ['==', ['get', 'aeroway'], 'terminal'],
  [
    'all',
    ['==', ['get', 'aeroway'], 'jet_bridge'],
    ['==', ['geometry-type'], 'Polygon'],
  ],
];

const airportGroundLayers = [
  {
    id: 'airport-overlay-taxiway-outline',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 8,
    filter: ['==', ['get', 'aeroway'], 'taxiway'],
    layout: {
      'line-cap': 'square',
      'line-join': 'miter',
    },
    paint: {
      'line-color': AIRPORT_OUTLINE,
      'line-width': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        8,
        0.3,
        11,
        1.5,
        14,
        7,
        20,
        28,
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.5, 1],
    },
  },
  {
    id: 'airport-overlay-taxiway-line',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 8,
    filter: ['==', ['get', 'aeroway'], 'taxiway'],
    layout: {
      'line-cap': 'square',
      'line-join': 'miter',
    },
    paint: {
      'line-color': AIRPORT_FILL,
      'line-width': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        8,
        0.25,
        11,
        0.75,
        14,
        4,
        20,
        24,
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.5, 1],
    },
  },
  {
    id: 'airport-overlay-apron',
    type: 'fill',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    filter: [
      'any',
      ['==', ['get', 'aeroway'], 'apron'],
      [
        'all',
        ['==', ['get', 'aeroway'], 'runway'],
        ['==', ['geometry-type'], 'Polygon'],
      ],
      [
        'all',
        ['==', ['get', 'aeroway'], 'taxiway'],
        ['==', ['geometry-type'], 'Polygon'],
      ],
    ],
    paint: {
      'fill-antialias': true,
      'fill-color': AIRPORT_FILL,
    },
  },
  {
    id: 'airport-overlay-apron-outline',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    filter: [
      'any',
      ['==', ['get', 'aeroway'], 'apron'],
      [
        'all',
        ['==', ['get', 'aeroway'], 'runway'],
        ['==', ['geometry-type'], 'Polygon'],
      ],
      [
        'all',
        ['==', ['get', 'aeroway'], 'taxiway'],
        ['==', ['geometry-type'], 'Polygon'],
      ],
    ],
    paint: {
      'line-color': AIRPORT_OUTLINE,
      'line-width': 0,
      'line-opacity': 0,
    },
  },
  {
    id: 'airport-overlay-runway-outline',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 7,
    filter: [
      'all',
      ['==', ['get', 'aeroway'], 'runway'],
      ['!=', ['geometry-type'], 'Polygon'],
    ],
    layout: {
      'line-cap': 'square',
    },
    paint: {
      'line-color': AIRPORT_OUTLINE,
      'line-width': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        8,
        0.75,
        10,
        4.5,
        11,
        6,
        14,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['+', ['*', 0.07, RUNWAY_WIDTH_VALUE], 4],
          9,
        ],
        16,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['+', ['/', RUNWAY_WIDTH_VALUE, 3.28], 6],
          31,
        ],
        20,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['+', ['*', 1.22, RUNWAY_WIDTH_VALUE], 8],
          99,
        ],
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1],
    },
  },
  {
    id: 'airport-overlay-runway-line',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 7,
    filter: [
      'all',
      ['==', ['get', 'aeroway'], 'runway'],
      ['!=', ['geometry-type'], 'Polygon'],
    ],
    layout: {
      'line-cap': 'square',
    },
    paint: {
      'line-color': AIRPORT_FILL_DARK,
      'line-width': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        8,
        0.5,
        10,
        2,
        11,
        4,
        14,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['*', 0.07, RUNWAY_WIDTH_VALUE],
          5,
        ],
        16,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['/', RUNWAY_WIDTH_VALUE, 3.28],
          23,
        ],
        20,
        [
          'case',
          ['any', ['has', 'width_m'], ['has', 'width']],
          ['*', 1.22, RUNWAY_WIDTH_VALUE],
          91,
        ],
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1],
    },
  },
] as const;

const airportBuildingLayers = [
  {
    id: 'airport-overlay-terminals-shadow',
    type: 'fill',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 13,
    filter: terminalFilter,
    paint: {
      'fill-color': AIRPORT_TERMINAL_SHADOW,
      'fill-opacity': AIRPORT_TERMINAL_SHADOW_OPACITY,
      'fill-translate': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        ['literal', AIRPORT_TERMINAL_SHADOW_OFFSET_Z13],
        15,
        ['literal', AIRPORT_TERMINAL_SHADOW_OFFSET_Z15],
      ],
    },
  },
  {
    id: 'airport-overlay-terminals',
    type: 'fill',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    filter: terminalFilter,
    paint: {
      'fill-color': AIRPORT_TERMINAL,
    },
  },
  {
    id: 'airport-overlay-jetbridge-shadow',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 15,
    filter: [
      'all',
      ['==', ['get', 'aeroway'], 'jet_bridge'],
      ['!=', ['geometry-type'], 'Polygon'],
    ],
    layout: {
      'line-cap': 'butt',
    },
    paint: {
      'line-color': AIRPORT_TERMINAL_SHADOW,
      'line-opacity': AIRPORT_TERMINAL_SHADOW_OPACITY,
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2, 19, 16],
      'line-translate': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        ['literal', AIRPORT_TERMINAL_SHADOW_OFFSET_Z13],
        15,
        ['literal', AIRPORT_TERMINAL_SHADOW_OFFSET_Z15],
      ],
    },
  },
  {
    id: 'airport-overlay-jetbridge',
    type: 'line',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 15,
    filter: [
      'all',
      ['==', ['get', 'aeroway'], 'jet_bridge'],
      ['!=', ['geometry-type'], 'Polygon'],
    ],
    layout: {
      'line-cap': 'butt',
    },
    paint: {
      'line-color': AIRPORT_TERMINAL,
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2, 19, 16],
    },
  },
] as const;

const airportLabelLayers = [
  {
    id: 'airport-overlay-gate-label',
    type: 'symbol',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport_labels',
    minzoom: 15,
    filter: ['all', ['==', ['get', 'type'], 'gate'], ['has', 'name']],
    layout: {
      'icon-image': getAirportGatePillImageId('light'),
      'icon-size': 1.2,
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 2, 0, 2],
      'text-field': ['get', 'name'],
      'text-font': ['Roboto Regular'],
      'text-size': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        14,
        8,
        16,
        11,
      ],
      'text-anchor': 'center',
      'icon-anchor': 'center',
      visibility: 'visible',
    },
    paint: {
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
      'text-color': '#3b82f6',
      'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
    },
  },
  {
    id: 'airport-overlay-terminal-labels',
    type: 'symbol',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport_labels',
    minzoom: 13,
    filter: ['==', ['get', 'type'], 'terminal'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': [
        'Montserrat Regular',
        'Open Sans Regular',
        'Noto Sans Regular',
      ],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        AIRPORT_TERMINAL_LABEL_SIZE_Z13,
        16,
        AIRPORT_TERMINAL_LABEL_SIZE_Z16,
      ],
      visibility: 'visible',
    },
    paint: {
      'text-color': AIRPORT_LABEL_STRONG,
      'text-halo-color': AIRPORT_HALO,
      'text-halo-width': 1.25,
    },
  },
  {
    id: 'airport-overlay-taxiway-labels',
    type: 'symbol',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 13,
    maxzoom: 24,
    filter: ['==', ['get', 'aeroway'], 'taxiway'],
    layout: {
      'text-field': '{ref}',
      'text-font': [
        'Montserrat Regular',
        'Open Sans Italic',
        'Noto Sans Italic',
      ],
      'text-size': ['interpolate', ['exponential', 1], ['zoom'], 13, 7, 20, 18],
      'text-anchor': 'center',
      'symbol-placement': 'line',
      visibility: 'visible',
    },
    paint: {
      'text-color': AIRPORT_LABEL,
      'text-halo-color': AIRPORT_HALO,
      'text-halo-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        11,
        0.1,
        15,
        0.75,
      ],
    },
  },
  {
    id: 'airport-overlay-runway-labels',
    type: 'symbol',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport',
    minzoom: 11,
    maxzoom: 24,
    filter: ['==', ['get', 'aeroway'], 'runway'],
    layout: {
      'text-field': '{ref}',
      'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Bold'],
      'text-size': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        12,
        8,
        18,
        28,
      ],
      'text-anchor': 'center',
      'symbol-placement': 'line',
      visibility: 'visible',
    },
    paint: {
      'text-color': AIRPORT_LABEL_STRONG,
      'text-halo-color': AIRPORT_HALO,
      'text-halo-width': ['interpolate', ['linear'], ['zoom'], 11, 0.1, 15, 1],
    },
  },
  {
    id: 'airport-overlay-name-label',
    type: 'symbol',
    source: AIRPORT_SOURCE,
    'source-layer': 'airport_nodes',
    minzoom: 9,
    filter: ['has', 'name'],
    layout: {
      'text-field': [
        'format',
        [
          'coalesce',
          ['get', 'label_name'],
          ['get', 'name:en'],
          ['get', 'name'],
        ],
        {
          'font-scale': 1,
        },
        '\n',
        {},
        ['coalesce', ['get', 'iata'], ['get', 'icao']],
        {
          'font-scale': 0.84,
        },
      ],
      'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 12, 12, 14, 15, 18],
      'text-line-height': 1,
      'text-letter-spacing': 0.02,
      'text-max-width': 10,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 1000],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      visibility: 'visible',
    },
    paint: {
      'text-color': AIRPORT_NAME,
      'text-halo-color': AIRPORT_HALO,
      'text-halo-width': 1.5,
      'text-halo-blur': 0.5,
    },
  },
] as const;

type AirportStyleDocument = {
  name?: string;
  center?: [number, number];
  zoom?: number;
  sources?: Record<string, Record<string, unknown>>;
  layers?: Array<Record<string, unknown>>;
};

export type AirportStyleTheme = 'light' | 'dark';

const insertOverlayLayers = (
  style: AirportStyleDocument,
  layersToInsert: ReadonlyArray<Record<string, unknown>>,
) => {
  const layers = style.layers ?? [];
  const groundInsertIndex = layers.findIndex(
    (layer) => layer.id === 'housenumber',
  );
  const fallbackInsertIndex = layers.findIndex(
    (layer) => layer.type === 'symbol',
  );
  const insertIndex =
    groundInsertIndex !== -1 ? groundInsertIndex + 1 : fallbackInsertIndex;
  if (insertIndex === -1) {
    throw new Error(
      'Could not find a symbol insertion point in the base style',
    );
  }

  style.layers = [
    ...layers.slice(0, insertIndex),
    ...layersToInsert,
    ...layers.slice(insertIndex),
  ];
};

const applyThemeOverrides = (
  style: AirportStyleDocument,
  theme: AirportStyleTheme,
) => {
  if (theme !== 'dark') {
    return;
  }

  style.layers = (style.layers ?? []).map((layer) => {
    const overrides =
      DARK_AIRPORT_PAINT_OVERRIDES[
        layer.id as keyof typeof DARK_AIRPORT_PAINT_OVERRIDES
      ];
    const layoutOverrides =
      DARK_AIRPORT_LAYOUT_OVERRIDES[
        layer.id as keyof typeof DARK_AIRPORT_LAYOUT_OVERRIDES
      ];
    if (!overrides && !layoutOverrides) {
      return layer;
    }

    return {
      ...layer,
      layout: {
        ...(layer.layout ?? {}),
        ...(layoutOverrides ?? {}),
      },
      paint: {
        ...(layer.paint ?? {}),
        ...(overrides ?? {}),
      },
    };
  });
};

export const buildPmtilesAirportStyle = (
  style: Record<string, unknown>,
  theme: AirportStyleTheme = 'light',
) => {
  const rewrittenStyle = structuredClone(style) as AirportStyleDocument;

  rewrittenStyle.name =
    theme === 'dark' ? 'Airport Style (Dark)' : 'Airport Style';
  rewrittenStyle.sources = {
    ...(rewrittenStyle.sources ?? {}),
    [AIRPORT_SOURCE]: {
      type: 'vector',
      url: 'pmtiles:///airport-overlay.pmtiles',
    },
  };

  insertOverlayLayers(rewrittenStyle, [
    ...airportGroundLayers,
    ...airportBuildingLayers,
    ...airportLabelLayers,
  ]);

  rewrittenStyle.layers = (rewrittenStyle.layers ?? []).map((layer) => {
    if (layer.id !== 'airport-overlay-gate-label') {
      return layer;
    }

    return {
      ...layer,
      layout: {
        ...(layer.layout ?? {}),
        'icon-image': getAirportGatePillImageId(theme),
      },
    };
  });

  applyThemeOverrides(rewrittenStyle, theme);

  return rewrittenStyle;
};
