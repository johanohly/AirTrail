import { describe, expect, test } from 'vitest';

import { buildAirportStyle, type AirportStyleProvider } from './airport-style';

const fonts = {
  regular: ['Noto Sans Regular'],
  emphasis: ['Noto Sans Bold'],
};

const buildStyle = ({
  attribution,
  creditsOpenStreetMap = false,
  layers = [],
  provider = 'local',
}: {
  attribution?: string;
  creditsOpenStreetMap?: boolean;
  layers?: Array<Record<string, unknown>>;
  provider?: AirportStyleProvider;
} = {}) =>
  buildAirportStyle(
    {
      version: 8,
      sources: {
        basemap: {
          type: 'vector',
          ...(attribution ? { attribution } : {}),
        },
      },
      layers,
    },
    { fonts, creditsOpenStreetMap, provider },
  );

describe('airport style attribution', () => {
  test('does not repeat OpenStreetMap attribution from the basemap', () => {
    const style = buildStyle({
      attribution: '&copy; CARTO, &copy; OpenStreetMap contributors',
    });

    expect(style.sources?.['airport-overlay']?.attribution).toBe('');
  });

  test('does not repeat attribution supplied by delayed TileJSON', () => {
    const style = buildStyle({ creditsOpenStreetMap: true });

    expect(style.sources?.['airport-overlay']?.attribution).toBe('');
  });

  test('credits OpenStreetMap when the basemap does not', () => {
    const style = buildStyle();

    expect(style.sources?.['airport-overlay']).toMatchObject({
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
  });
});

describe('airport overlay placement', () => {
  test('draws above basemap runways and roads that follow an early symbol layer', () => {
    const style = buildStyle({
      provider: 'openfreemap',
      layers: [
        { id: 'water_name', type: 'symbol', 'source-layer': 'water_name' },
        { id: 'aeroway-runway', type: 'line', 'source-layer': 'aeroway' },
        { id: 'highway_minor', type: 'line', 'source-layer': 'transportation' },
        { id: 'road_oneway', type: 'symbol', 'source-layer': 'transportation' },
        { id: 'railway', type: 'line', 'source-layer': 'transportation' },
        {
          id: 'highway_name_other',
          type: 'symbol',
          'source-layer': 'transportation_name',
        },
      ],
    });
    const ids = style.layers?.map((layer) => layer.id) ?? [];
    const apronIndex = ids.indexOf('airport-overlay-apron');

    expect(apronIndex).toBeGreaterThan(ids.indexOf('railway'));
    expect(apronIndex).toBeLessThan(ids.indexOf('highway_name_other'));
  });
});

describe('airport overlay provider adaptations', () => {
  test('removes OpenFreeMap airport labels without hiding other layers', () => {
    const style = buildStyle({
      provider: 'openfreemap',
      layers: [
        {
          id: 'aeroway-runway',
          type: 'line',
          'source-layer': 'aeroway',
        },
        {
          id: 'airport',
          type: 'symbol',
          'source-layer': 'aerodrome_label',
        },
        {
          id: 'place-city',
          type: 'symbol',
          'source-layer': 'place',
        },
      ],
    });

    expect(style.layers?.map((layer) => layer.id)).not.toContain('airport');
    expect(style.layers?.map((layer) => layer.id)).toEqual(
      expect.arrayContaining(['aeroway-runway', 'place-city']),
    );
  });

  test('excludes only aerodromes from the Protomaps POI layer', () => {
    const originalFilter = ['>=', ['zoom'], ['get', 'min_zoom']];
    const style = buildStyle({
      provider: 'protomaps',
      layers: [
        {
          id: 'pois',
          type: 'symbol',
          'source-layer': 'pois',
          filter: originalFilter,
        },
      ],
    });

    expect(style.layers?.find((layer) => layer.id === 'pois')?.filter).toEqual([
      'all',
      originalFilter,
      ['!=', ['get', 'kind'], 'aerodrome'],
    ]);
  });
});
