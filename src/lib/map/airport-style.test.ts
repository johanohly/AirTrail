import { describe, expect, test } from 'vitest';

import { buildAirportStyle } from './airport-style';

const fonts = {
  regular: ['Noto Sans Regular'],
  emphasis: ['Noto Sans Bold'],
};

const buildStyle = ({
  attribution,
  creditsOpenStreetMap = false,
}: {
  attribution?: string;
  creditsOpenStreetMap?: boolean;
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
      layers: [],
    },
    { fonts, creditsOpenStreetMap },
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
