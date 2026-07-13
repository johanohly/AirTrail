// @ts-nocheck -- These synthetic GeoJSON fixtures are validated at runtime.

import { describe, expect, it } from 'vitest';

import countryBounds from '../../../static/countries-bounds.json';
import {
  mergeCountryFeatures,
  validateCountryPointAssignments,
} from '../../../scripts/data/country-geojson.js';

const polygonFeature = (properties, bounds = [0, 0, 1, 1]) => {
  const [west, south, east, north] = bounds;
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
};

const overrideSources = {
  nuts: {
    type: 'FeatureCollection',
    features: [
      polygonFeature({ NUTS_ID: 'RS', source: 'nuts' }),
      polygonFeature({ NUTS_ID: 'XK', source: 'nuts' }),
    ],
  },
  naturalEarth: {
    type: 'FeatureCollection',
    features: [
      polygonFeature({ ADM0_A3: 'CHN', source: 'natural-earth' }),
      polygonFeature({ ADM0_A3: 'TWN', source: 'natural-earth' }),
    ],
  },
};

describe('country GeoJSON', () => {
  it('applies the configured geometry overrides and code aliases', () => {
    const merged = mergeCountryFeatures(
      {
        type: 'FeatureCollection',
        features: [
          polygonFeature({ CNTR_ID: 'DK', ISO3_CODE: 'DNK' }),
          polygonFeature({ CNTR_ID: 'EL', ISO3_CODE: 'GRC' }),
          polygonFeature({ CNTR_ID: 'UK', ISO3_CODE: 'GBR' }),
          polygonFeature({ CNTR_ID: 'RS', source: 'world' }),
          polygonFeature({ CNTR_ID: 'CN', source: 'world' }),
        ],
      },
      overrideSources,
    );

    expect(
      merged.features.map((item) => [
        item.properties.COUNTRY_CODE,
        item.properties.source,
      ]),
    ).toEqual([
      ['DK', undefined],
      ['GR', undefined],
      ['GB', undefined],
      ['RS', 'nuts'],
      ['XK', 'nuts'],
      ['CN', 'natural-earth'],
      ['TW', 'natural-earth'],
    ]);
  });

  it('fails instead of silently omitting a configured override', () => {
    expect(() =>
      mergeCountryFeatures(
        { type: 'FeatureCollection', features: [] },
        {
          ...overrideSources,
          nuts: {
            type: 'FeatureCollection',
            features: [polygonFeature({ NUTS_ID: 'RS' })],
          },
        },
      ),
    ).toThrow('nuts country data is missing XK for XK');
  });

  it('validates representative locations and disputed boundaries', () => {
    const countries = {
      type: 'FeatureCollection',
      features: [
        polygonFeature({ COUNTRY_CODE: 'TW' }, [121, 24, 122, 26]),
        polygonFeature({ COUNTRY_CODE: 'PS' }, [34, 31, 35, 32]),
        polygonFeature({ COUNTRY_CODE: 'XK' }, [20, 42, 22, 43]),
        polygonFeature({ COUNTRY_CODE: 'RS' }, [19, 44, 22, 46]),
      ],
    };

    expect(() => validateCountryPointAssignments(countries)).not.toThrow();
    countries.features.push(
      polygonFeature({ COUNTRY_CODE: 'CN' }, [121, 24, 122, 26]),
    );
    expect(() => validateCountryPointAssignments(countries)).toThrow(
      'Taipei must not overlap CN',
    );
  });

  it('ships bounds for the selectable disputed-territory features', () => {
    expect(countryBounds).toHaveProperty('PS');
    expect(countryBounds).toHaveProperty('RS');
    expect(countryBounds).toHaveProperty('TW');
    expect(countryBounds).toHaveProperty('XK');
  });
});
