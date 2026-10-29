import { describe, expect, it } from 'vitest';

import {
  MAP_PREFERENCE_DEFAULTS,
  sanitizeMapPreferences,
} from './map-preferences.svelte';

describe('map preferences', () => {
  it('sanitizes every preference from the canonical definitions', () => {
    const preferences = sanitizeMapPreferences({
      projection: 'globe',
      routeDisplay: 'invalid',
      openAipGroups: ['airports', 'invalid'],
    });

    expect(preferences.projection).toBe('globe');
    expect(preferences.routeDisplay).toBe(MAP_PREFERENCE_DEFAULTS.routeDisplay);
    expect(preferences.openAipGroups).toEqual(['airports']);
    expect(Object.keys(preferences)).toEqual(
      Object.keys(MAP_PREFERENCE_DEFAULTS),
    );
  });

  it('sanitizes the focused route display override', () => {
    const override = sanitizeMapPreferences({ focusedRouteDisplay: 'points' });
    expect(override.focusedRouteDisplay).toBe('points');

    const invalid = sanitizeMapPreferences({ focusedRouteDisplay: 'invalid' });
    expect(invalid.focusedRouteDisplay).toBeNull();

    const missing = sanitizeMapPreferences({});
    expect(missing.focusedRouteDisplay).toBeNull();
    expect(MAP_PREFERENCE_DEFAULTS.focusedRouteDisplay).toBeNull();
  });
});
