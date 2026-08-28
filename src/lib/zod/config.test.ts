import { describe, expect, test } from 'vitest';

import {
  appConfigSchema,
  clientAppConfigSchema,
  mapConfigSchema,
  mapSettingsFormSchema,
} from './config';

describe('map configuration', () => {
  test('defaults to OpenFreeMap and migrates legacy managed URLs', () => {
    const config = mapConfigSchema.parse({
      lightStyleUrl: '/api/map-styles/airport/style.json?theme=light',
      darkStyleUrl: '/api/map-styles/airport/style.json?theme=dark',
    });

    expect(config.provider).toBe('openfreemap');
    expect(config.lightStyleUrl).toBeNull();
    expect(config.darkStyleUrl).toBeNull();
  });

  test('does not expose basemap API keys in client configuration', () => {
    const serverConfig = appConfigSchema.parse({
      oauth: {
        enabled: false,
        issuerUrl: null,
        clientId: null,
        clientSecret: null,
      },
      integrations: { aeroDataBoxKey: null, openAipKey: null },
      map: {
        cartoApiKey: 'carto-secret',
        protomapsApiKey: 'protomaps-secret',
      },
      data: { lastSynced: null },
    });

    const clientConfig = clientAppConfigSchema.parse(serverConfig);
    expect(clientConfig.map).not.toHaveProperty('cartoApiKey');
    expect(clientConfig.map).not.toHaveProperty('protomapsApiKey');
  });

  test('accepts same-origin Protomaps assets and rejects unsafe schemes', () => {
    expect(
      mapConfigSchema.parse({ protomapsAssetsBaseUrl: '/basemap-assets/' })
        .protomapsAssetsBaseUrl,
    ).toBe('/basemap-assets');
    expect(() =>
      mapConfigSchema.parse({
        protomapsAssetsBaseUrl: 'javascript:alert(1)',
      }),
    ).toThrow();
  });

  test('supplies safe defaults when conditional Protomaps fields are omitted', () => {
    const form = mapSettingsFormSchema.parse({
      provider: 'carto',
      protomapsAssetsBaseUrl: '',
      protomapsLanguage: '',
      protomapsMaxZoom: null,
    });

    expect(form.protomapsAssetsBaseUrl).toBe(
      'https://protomaps.github.io/basemaps-assets',
    );
    expect(form.protomapsLanguage).toBe('en');
    expect(form.protomapsMaxZoom).toBe(15);
  });
});
