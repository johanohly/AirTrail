import { beforeEach, describe, expect, it } from 'vitest';

import { mapPreferences } from './map/map-preferences.svelte';
import {
  closeMapDetails,
  getEffectiveRouteDisplay,
  mapDetailsState,
  openAirportDetails,
  openFlightDetails,
  openRouteDetails,
} from './state.svelte';

describe('getEffectiveRouteDisplay', () => {
  beforeEach(() => {
    mapDetailsState.selection = null;
    mapPreferences.routeDisplay = 'tracks';
    mapPreferences.focusedRouteDisplay = null;
  });

  it('falls back to the global preference when the override is null', () => {
    expect(getEffectiveRouteDisplay()).toBe('tracks');

    openFlightDetails(1);
    expect(getEffectiveRouteDisplay()).toBe('tracks');

    mapPreferences.routeDisplay = 'points';
    expect(getEffectiveRouteDisplay()).toBe('points');
  });

  it('applies the override only while a flight is selected', () => {
    mapPreferences.focusedRouteDisplay = 'points';

    openFlightDetails(1);
    expect(getEffectiveRouteDisplay()).toBe('points');

    openAirportDetails(2);
    expect(getEffectiveRouteDisplay()).toBe('tracks');

    openFlightDetails(1);
    expect(getEffectiveRouteDisplay()).toBe('points');

    closeMapDetails();
    expect(getEffectiveRouteDisplay()).toBe('tracks');
  });

  it('applies the override while a route is selected', () => {
    mapPreferences.focusedRouteDisplay = 'points';

    openRouteDetails({ a: '1', b: '2' });
    expect(getEffectiveRouteDisplay()).toBe('points');

    closeMapDetails();
    expect(getEffectiveRouteDisplay()).toBe('tracks');
  });
});
