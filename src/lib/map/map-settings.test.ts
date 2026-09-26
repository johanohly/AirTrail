import { describe, expect, test } from 'vitest';

import { mapConfigSchema, mapSettingsFormSchema } from '$lib/zod/config';

import {
  hasMapSettingsChanges,
  mapConfigsHaveSameSettings,
  mergeMapSettings,
  toMapSettingsFormData,
} from './map-settings';

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
      styleRevision: 4,
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

  test('compares map settings without treating the revision as user data', () => {
    const current = mapConfigSchema.parse({ styleRevision: 2 });

    expect(
      mapConfigsHaveSameSettings(current, {
        ...current,
        styleRevision: 99,
      }),
    ).toBe(true);
    expect(
      mapConfigsHaveSameSettings(current, {
        ...current,
        provider: 'carto',
      }),
    ).toBe(false);
  });
});

describe('map settings dirty state', () => {
  const configuredMap = () =>
    mapConfigSchema.parse({
      provider: 'protomaps',
      cartoApiKey: 'saved-carto-key',
      protomapsSourceKind: 'pmtiles',
      protomapsApiKey: 'saved-protomaps-key',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsMaxZoom: 12,
      protomapsAssetsBaseUrl: '/basemap-assets',
      protomapsLanguage: 'de',
      styleRevision: 4,
    });

  test('stays clean for normalized and reverted values', () => {
    const current = configuredMap();
    const form = toMapSettingsFormData(current);

    expect(hasMapSettingsChanges(current, form)).toBe(false);
    expect(
      hasMapSettingsChanges(current, {
        ...form,
        protomapsAssetsBaseUrl: '/basemap-assets/',
      }),
    ).toBe(false);
  });

  test('ignores inactive Protomaps fields because saving preserves them', () => {
    const current = mapConfigSchema.parse({
      provider: 'openfreemap',
      protomapsSourceKind: 'pmtiles',
      protomapsSourceUrl: 'https://tiles.example.com/world.pmtiles',
      protomapsLanguage: 'de',
    });
    const form = {
      ...toMapSettingsFormData(current),
      protomapsSourceKind: 'zxy',
      protomapsSourceUrl: 'https://ignored.example/{z}/{x}/{y}.mvt',
      protomapsLanguage: 'fr',
    };

    expect(hasMapSettingsChanges(current, form)).toBe(false);
  });

  test('matches conditional persistence inside the active Protomaps provider', () => {
    const current = configuredMap();
    const form = toMapSettingsFormData(current);

    expect(
      hasMapSettingsChanges(current, {
        ...form,
        protomapsMaxZoom: 20,
      }),
    ).toBe(false);
    expect(
      hasMapSettingsChanges(current, {
        ...form,
        protomapsSourceUrl: 'https://tiles.example.com/next.pmtiles',
      }),
    ).toBe(true);
    expect(
      hasMapSettingsChanges(current, {
        ...form,
        protomapsLanguage: 'fr',
      }),
    ).toBe(true);
  });

  test('detects every credential operation using save precedence', () => {
    const current = configuredMap();
    const form = toMapSettingsFormData(current);

    expect(
      hasMapSettingsChanges(current, {
        ...form,
        cartoApiKey: 'saved-carto-key',
      }),
    ).toBe(false);
    expect(
      hasMapSettingsChanges(current, {
        ...form,
        cartoApiKey: 'replacement-key',
      }),
    ).toBe(true);
    expect(
      hasMapSettingsChanges(current, {
        ...form,
        clearCartoApiKey: true,
      }),
    ).toBe(true);

    const withoutCredentials = mapConfigSchema.parse({});
    expect(
      hasMapSettingsChanges(withoutCredentials, {
        ...toMapSettingsFormData(withoutCredentials),
        cartoApiKey: 'ignored-by-clear',
        clearCartoApiKey: true,
      }),
    ).toBe(false);
  });

  test('uses redacted credential state without exposing the secret', () => {
    const current = configuredMap();
    const {
      cartoApiKey: _cartoApiKey,
      protomapsApiKey: _protomapsApiKey,
      ...publicConfig
    } = current;
    const form = toMapSettingsFormData(publicConfig);

    expect(
      hasMapSettingsChanges(publicConfig, form, {
        cartoApiKey: true,
        protomapsApiKey: true,
      }),
    ).toBe(false);
    expect(
      hasMapSettingsChanges(
        publicConfig,
        { ...form, clearProtomapsApiKey: true },
        { cartoApiKey: true, protomapsApiKey: true },
      ),
    ).toBe(true);
  });

  test('treats invalid edited form state as dirty', () => {
    const current = configuredMap();

    expect(
      hasMapSettingsChanges(current, {
        ...toMapSettingsFormData(current),
        protomapsMaxZoom: 99,
      }),
    ).toBe(true);
  });
});
