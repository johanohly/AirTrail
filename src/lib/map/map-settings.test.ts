import { describe, expect, test } from 'vitest';

import { mapConfigSchema, mapSettingsFormSchema } from '$lib/zod/config';

import { mergeMapSettings, toMapSettingsFormData } from './map-settings';

describe('map settings persistence', () => {
  test('preserves inactive provider settings when saving OpenFreeMap', () => {
    const current = mapConfigSchema.parse({
      provider: 'protomaps',
      cartoApiKey: 'carto-secret',
      protomapsSourceKind: 'pmtiles',
      protomapsApiKey: 'protomaps-secret',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsMaxZoom: 12,
      protomapsAssetsBaseUrl: '/basemap-assets',
      protomapsLanguage: 'de',
      styleRevision: 4,
    });
    const submitted = mapSettingsFormSchema.parse({
      provider: 'openfreemap',
      lightStyleUrl: 'https://styles.example.com/light.json',
    });

    const merged = mergeMapSettings(current, submitted);

    expect(merged).toMatchObject({
      provider: 'openfreemap',
      cartoApiKey: 'carto-secret',
      protomapsSourceKind: 'pmtiles',
      protomapsApiKey: 'protomaps-secret',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsMaxZoom: 12,
      protomapsAssetsBaseUrl: '/basemap-assets',
      protomapsLanguage: 'de',
      lightStyleUrl: 'https://styles.example.com/light.json',
      styleRevision: 5,
    });
  });

  test('updates the active Protomaps source without discarding ZXY metadata', () => {
    const current = mapConfigSchema.parse({
      provider: 'protomaps',
      protomapsSourceKind: 'pmtiles',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsMaxZoom: 10,
    });
    const submitted = mapSettingsFormSchema.parse({
      ...toMapSettingsFormData(current),
      protomapsSourceKind: 'zxy',
      protomapsSourceUrl: 'https://tiles.example.com/{z}/{x}/{y}.mvt',
      protomapsMaxZoom: 16,
      protomapsLanguage: 'fr',
    });

    expect(mergeMapSettings(current, submitted)).toMatchObject({
      protomapsSourceKind: 'zxy',
      protomapsSourceUrl: 'https://tiles.example.com/{z}/{x}/{y}.mvt',
      protomapsMaxZoom: 16,
      protomapsLanguage: 'fr',
    });
  });

  test('applies replacement and removal semantics without returning secrets', () => {
    const current = mapConfigSchema.parse({
      cartoApiKey: 'old-carto-key',
      protomapsApiKey: 'old-protomaps-key',
    });
    const submitted = mapSettingsFormSchema.parse({
      ...toMapSettingsFormData(current),
      provider: 'carto',
      cartoApiKey: 'new-carto-key',
      clearProtomapsApiKey: true,
    });
    const merged = mergeMapSettings(current, submitted);

    expect(merged.cartoApiKey).toBe('new-carto-key');
    expect(merged.protomapsApiKey).toBeNull();
    expect(toMapSettingsFormData(merged)).toMatchObject({
      cartoApiKey: '',
      clearCartoApiKey: false,
      protomapsApiKey: '',
      clearProtomapsApiKey: false,
    });
  });
});
