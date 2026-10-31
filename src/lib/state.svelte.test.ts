import { beforeEach, describe, expect, it } from 'vitest';

import { mapPreferences } from './map/map-preferences.svelte';
import {
  closeMapDetails,
  getFlightRouteDisplay,
  getFocusedRouteDisplay,
  isFocusedFlight,
  mapDetailsState,
  openAirportDetails,
  openFlightDetails,
  openRouteDetails,
  setRouteDisplayPreference,
  toggleFocusedRouteDisplay,
} from './state.svelte';

const onRoute = { id: 1, from: { id: 10 }, to: { id: 20 } };
const onReverseRoute = { id: 2, from: { id: 20 }, to: { id: 10 } };
const elsewhere = { id: 3, from: { id: 10 }, to: { id: 30 } };

describe('focused route display', () => {
  beforeEach(() => {
    closeMapDetails();
    mapPreferences.routeDisplay = 'tracks';
  });

  it('follows the map setting until toggled', () => {
    openFlightDetails(1);
    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');

    mapPreferences.routeDisplay = 'points';
    expect(getFlightRouteDisplay(onRoute)).toBe('points');
  });

  it('switches only the focused flight', () => {
    openFlightDetails(1);
    toggleFocusedRouteDisplay();

    expect(getFlightRouteDisplay(onRoute)).toBe('points');
    expect(getFlightRouteDisplay(onReverseRoute)).toBe('tracks');
  });

  it('switches both directions of the focused route and nothing else', () => {
    openRouteDetails({ a: '10', b: '20' });
    toggleFocusedRouteDisplay();

    expect(getFlightRouteDisplay(onRoute)).toBe('points');
    expect(getFlightRouteDisplay(onReverseRoute)).toBe('points');
    expect(getFlightRouteDisplay(elsewhere)).toBe('tracks');
  });

  it('can show tracks for the focused route when the map shows arcs', () => {
    mapPreferences.routeDisplay = 'points';
    openRouteDetails({ a: '10', b: '20' });
    toggleFocusedRouteDisplay();

    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');
    expect(getFlightRouteDisplay(elsewhere)).toBe('points');
  });

  it('never writes the toggle to the map setting', () => {
    openFlightDetails(1);
    toggleFocusedRouteDisplay();

    expect(mapPreferences.routeDisplay).toBe('tracks');
    expect(mapPreferences).not.toHaveProperty('focusedRouteDisplay');
  });

  it('drops the override when toggled back', () => {
    openFlightDetails(1);
    toggleFocusedRouteDisplay();
    toggleFocusedRouteDisplay();

    expect(mapDetailsState.focusedRouteDisplay).toBeNull();
    expect(getFocusedRouteDisplay()).toBe('tracks');
  });

  it('resets when the pane closes', () => {
    openFlightDetails(1);
    toggleFocusedRouteDisplay();
    closeMapDetails();

    expect(mapDetailsState.focusedRouteDisplay).toBeNull();
    openFlightDetails(1);
    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');
  });

  it('resets when the pane moves to something else', () => {
    openRouteDetails({ a: '10', b: '20' });
    toggleFocusedRouteDisplay();
    openFlightDetails(1);
    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');

    toggleFocusedRouteDisplay();
    openRouteDetails({ a: '10', b: '20' });
    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');

    toggleFocusedRouteDisplay();
    openAirportDetails(10);
    expect(mapDetailsState.focusedRouteDisplay).toBeNull();
  });

  it('ignores the toggle without a focused flight or route', () => {
    toggleFocusedRouteDisplay();
    expect(mapDetailsState.focusedRouteDisplay).toBeNull();

    openAirportDetails(10);
    toggleFocusedRouteDisplay();
    expect(mapDetailsState.focusedRouteDisplay).toBeNull();
    expect(isFocusedFlight(onRoute)).toBe(false);
  });

  it('lets the map setting take over from the toggle', () => {
    openFlightDetails(1);
    toggleFocusedRouteDisplay();
    setRouteDisplayPreference('tracks');

    expect(getFlightRouteDisplay(onRoute)).toBe('tracks');

    setRouteDisplayPreference('points');
    expect(getFlightRouteDisplay(onRoute)).toBe('points');
    expect(getFlightRouteDisplay(elsewhere)).toBe('points');
  });
});
