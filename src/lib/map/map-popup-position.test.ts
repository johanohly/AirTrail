import { describe, expect, it } from 'vitest';

import { getPopupAnchor } from './map-popup-position';

describe('map popup position', () => {
  const container = { clientWidth: 1_000, clientHeight: 800 };
  const popupSize = { width: 320, height: 280 };

  it('anchors away from map edges', () => {
    expect(getPopupAnchor({ x: 100, y: 100 }, container, popupSize)).toBe(
      'top-left',
    );
    expect(getPopupAnchor({ x: 900, y: 700 }, container, popupSize)).toBe(
      'bottom-right',
    );
  });
});
