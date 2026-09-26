import { describe, expect, test } from 'vitest';

import {
  getConfiguredAppMapStyleUrl,
  getDefaultAppMapStyleUrl,
} from './app-style';

describe('managed app map styles', () => {
  test('includes the configuration revision in managed style URLs', () => {
    expect(getDefaultAppMapStyleUrl('dark', 'default', 7)).toBe(
      '/api/map-styles/airport/style.json?theme=dark&v=7',
    );
    expect(getDefaultAppMapStyleUrl('light', 'satellite', 7)).toBe(
      '/api/map-styles/airport/style.json?theme=light&v=7&basemap=satellite',
    );
  });

  test('preserves custom overrides but always manages satellite styles', () => {
    const config = {
      lightStyleUrl: 'https://maps.example.com/light.json',
      darkStyleUrl: null,
      styleRevision: 4,
    };

    expect(getConfiguredAppMapStyleUrl('light', config)).toBe(
      'https://maps.example.com/light.json',
    );
    expect(getConfiguredAppMapStyleUrl('dark', config)).toBe(
      '/api/map-styles/airport/style.json?theme=dark&v=4',
    );
    expect(getConfiguredAppMapStyleUrl('light', config, 'satellite')).toBe(
      '/api/map-styles/airport/style.json?theme=light&v=4&basemap=satellite',
    );
  });
});
