import { describe, expect, it } from 'vitest';

import { getOverlayPixelRatio } from './overlay-pixel-ratio';

const bufferSize = (cssWidth: number, cssHeight: number, ratio: number) => [
  Math.floor(cssWidth * ratio),
  Math.floor(cssHeight * ratio),
];

describe('getOverlayPixelRatio', () => {
  it('keeps a portrait overlay within the limit at the shape of the map', () => {
    const ratio = getOverlayPixelRatio(
      { width: 2270, height: 4096 },
      { clientWidth: 980, clientHeight: 1768 },
    );

    expect(bufferSize(980, 1768, ratio as number)).toEqual([2270, 4095]);
  });

  it('keeps a landscape overlay within the limit at the shape of the map', () => {
    const ratio = getOverlayPixelRatio(
      { width: 4096, height: 2270 },
      { clientWidth: 1768, clientHeight: 980 },
    );

    expect(bufferSize(1768, 980, ratio as number)).toEqual([4095, 2270]);
  });

  it('follows the device ratio when the map is not clamped', () => {
    const ratio = getOverlayPixelRatio(
      { width: 3840, height: 2160 },
      { clientWidth: 1920, clientHeight: 1080 },
    );

    expect(ratio).toBe(2);
  });

  it('falls back to device pixels for a container with no size', () => {
    expect(
      getOverlayPixelRatio(
        { width: 300, height: 150 },
        { clientWidth: 0, clientHeight: 0 },
      ),
    ).toBe(true);
  });
});
