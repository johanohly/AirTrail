import { describe, expect, test, vi } from 'vitest';

import { mapConfigSchema, type MapConfig } from '$lib/zod/config';

import {
  getMapProviderConfigurationIssue,
  loadProviderStyle,
} from './basemap-style';

const baseConfig = () => mapConfigSchema.parse({});

describe('basemap providers', () => {
  test('builds a self-hosted PMTiles Protomaps style', async () => {
    const config = {
      ...baseConfig(),
      provider: 'protomaps',
      protomapsSourceKind: 'pmtiles',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsAssetsBaseUrl: 'https://assets.example.com/basemaps',
    } satisfies MapConfig;

    const { style, fonts } = await loadProviderStyle({
      config,
      fetchFn: vi.fn<typeof fetch>(),
      requestOrigin: 'https://airtrail.example',
      theme: 'dark',
    });

    expect(style.sources.protomaps).toMatchObject({
      type: 'vector',
      url: 'pmtiles://https://tiles.example.com/world.pmtiles',
      attribution:
        '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    expect(style.glyphs).toBe(
      'https://assets.example.com/basemaps/fonts/{fontstack}/{range}.pbf',
    );
    expect(style.sprite).toBe(
      'https://assets.example.com/basemaps/sprites/v4/dark',
    );
    expect(style.layers.length).toBeGreaterThan(20);
    expect(fonts.emphasis).toEqual(['Noto Sans Medium']);
  });

  test('resolves root-relative Protomaps assets against the AirTrail origin', async () => {
    const { style } = await loadProviderStyle({
      config: {
        ...baseConfig(),
        provider: 'protomaps',
        protomapsSourceKind: 'pmtiles',
        protomapsSourceUrl: '/world.pmtiles',
        protomapsAssetsBaseUrl: '/basemap-assets',
      },
      fetchFn: vi.fn<typeof fetch>(),
      requestOrigin: 'https://airtrail.example',
      theme: 'light',
    });

    expect(style.glyphs).toBe(
      'https://airtrail.example/basemap-assets/fonts/{fontstack}/{range}.pbf',
    );
    expect(style.sprite).toBe(
      'https://airtrail.example/basemap-assets/sprites/v4/light',
    );
  });

  test('validates and signs the hosted Protomaps TileJSON', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({
        tiles: ['https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt'],
        attribution: 'Protomaps data attribution',
        minzoom: 0,
        maxzoom: 15,
      }),
    );
    const { style } = await loadProviderStyle({
      config: {
        ...baseConfig(),
        provider: 'protomaps',
        protomapsApiKey: 'test-key',
      },
      fetchFn,
      requestOrigin: 'https://airtrail.example',
      theme: 'light',
    });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.protomaps.com/tiles/v4.json?key=test-key',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(style.sources.protomaps).toMatchObject({
      type: 'vector',
      tiles: [
        'https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=test-key',
      ],
      attribution:
        '&copy; <a href="https://protomaps.com">Protomaps</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minzoom: 0,
      maxzoom: 15,
    });
    expect(style.sources.protomaps).not.toHaveProperty('url');
  });

  test('requires credentials and validates ZXY templates', () => {
    expect(
      getMapProviderConfigurationIssue({
        ...baseConfig(),
        provider: 'carto',
      }),
    ).toBe('CARTO requires an API key.');
    expect(
      getMapProviderConfigurationIssue({
        ...baseConfig(),
        provider: 'protomaps',
        protomapsSourceKind: 'zxy',
        protomapsSourceUrl: 'https://tiles.example.com/{z}/{x}.mvt',
      }),
    ).toBe('A ZXY URL must contain {z}, {x}, and {y} placeholders.');
  });

  test('signs every CARTO resource used by the generated style', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('tiles.json')) {
        return Response.json({
          tiles: [
            'https://tiles-a.basemaps.cartocdn.com/vector/{z}/{x}/{y}.mvt',
          ],
          attribution: 'CARTO and OpenStreetMap',
          maxzoom: 14,
        });
      }
      return Response.json({
        version: 8,
        glyphs:
          'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
        sprite: 'https://tiles.basemaps.cartocdn.com/style/sprite',
        sources: {
          carto: {
            type: 'vector',
            url: 'https://tiles.basemaps.cartocdn.com/vector/tiles.json',
          },
        },
        layers: [{ id: 'background', type: 'background' }],
      });
    });
    const { style } = await loadProviderStyle({
      config: {
        ...baseConfig(),
        provider: 'carto',
        cartoApiKey: 'test-key',
      },
      fetchFn,
      requestOrigin: 'https://airtrail.example',
      theme: 'light',
    });

    expect(style.glyphs).toContain('key=test-key');
    expect(style.sprite).toContain('key=test-key');
    expect(style.sources.carto).not.toHaveProperty('url');
    expect(style.sources.carto).toMatchObject({
      tiles: [
        'https://tiles-a.basemaps.cartocdn.com/vector/{z}/{x}/{y}.mvt?key=test-key',
      ],
      attribution: 'CARTO and OpenStreetMap',
      maxzoom: 14,
    });
  });

  test('preserves OpenFreeMap layers before composing the airport overlay', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({
        version: 8,
        sources: {},
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
      }),
    );

    const { style, provider } = await loadProviderStyle({
      config: baseConfig(),
      fetchFn,
      requestOrigin: 'https://airtrail.example',
      theme: 'light',
    });

    expect(provider).toBe('openfreemap');
    expect(style.layers.map((layer) => layer.id)).toEqual([
      'aeroway-runway',
      'airport',
      'place-city',
    ]);
  });

  test('backs off before retrying an upstream provider after serving stale style data', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T10:00:00Z'));

    try {
      const { loadProviderStyle: loadFreshProviderStyle } =
        await import('./basemap-style');
      const fetchFn = vi.fn<typeof fetch>(async () => {
        if (fetchFn.mock.calls.length === 1) {
          return Response.json({
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background' }],
          });
        }
        throw new Error('provider unavailable');
      });
      const request = {
        config: baseConfig(),
        fetchFn,
        requestOrigin: 'https://airtrail.example',
        theme: 'light',
      } satisfies Parameters<typeof loadFreshProviderStyle>[0];

      await loadFreshProviderStyle(request);
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      await loadFreshProviderStyle(request);
      await loadFreshProviderStyle(request);

      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      vi.resetModules();
    }
  });
});
