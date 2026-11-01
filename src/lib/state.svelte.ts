import {
  normalizeRoute,
  routeMatchesEndpoints,
  type Route,
} from '$lib/components/flight-filters/types';
import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
import { DEFAULT_FLIGHT_SCOPE, type FlightScope } from '$lib/flight-scope';
import {
  mapPreferences,
  type RouteDisplayMode,
} from '$lib/map/map-preferences.svelte';
import type { DeepBoolean } from '$lib/utils';

export const flightAddedState = $state({
  added: false,
});

export const flightListFocusState = $state<{
  flightId: number | null;
  request: number;
}>({
  flightId: null,
  request: 0,
});

export const focusFlightInList = (flightId: number) => {
  flightListFocusState.flightId = flightId;
  flightListFocusState.request += 1;
};

export const clearFlightListFocus = () => {
  flightListFocusState.flightId = null;
  flightListFocusState.request += 1;
};

export type SettingsTabId =
  | 'general'
  | 'preferences'
  | 'security'
  | 'appearance'
  | 'share'
  | 'import'
  | 'export'
  | 'data'
  | 'custom-fields'
  | 'integrations'
  | 'users'
  | 'oauth';

export type OpenModalsState = {
  addFlight: boolean;
  listFlights: boolean;
  statistics: boolean;
  settings: boolean;
  settingsTab: SettingsTabId;
};

export const openModalsState = $state<OpenModalsState>({
  addFlight: false,
  listFlights: false,
  statistics: false,
  settings: false,
  settingsTab: 'general',
});

export type MapDetailsSelection =
  | { type: 'airport'; airportId: number }
  | { type: 'route'; route: Route }
  | { type: 'flight'; flightId: number };

export const mapDetailsState = $state<{
  selection: MapDetailsSelection | null;
  focusRequest: number;
  hoveredFlightTrackId: number | null;
  /** Temporary override for the focused flight or route, null when following the map setting. */
  focusedRouteDisplay: RouteDisplayMode | null;
}>({
  selection: null,
  focusRequest: 0,
  hoveredFlightTrackId: null,
  focusedRouteDisplay: null,
});

export const openAirportDetails = (airportId: number) => {
  mapDetailsState.selection = { type: 'airport', airportId };
  mapDetailsState.focusedRouteDisplay = null;
  mapDetailsState.focusRequest += 1;
};

export const openRouteDetails = (route: Route) => {
  mapDetailsState.selection = {
    type: 'route',
    route: normalizeRoute(route.a, route.b),
  };
  mapDetailsState.focusedRouteDisplay = null;
  mapDetailsState.focusRequest += 1;
};

export const openFlightDetails = (flightId: number) => {
  mapDetailsState.selection = { type: 'flight', flightId };
  mapDetailsState.focusedRouteDisplay = null;
  mapDetailsState.focusRequest += 1;
};

export const focusMapDetails = () => {
  if (!mapDetailsState.selection) return;
  mapDetailsState.focusRequest += 1;
};

export const closeMapDetails = () => {
  mapDetailsState.selection = null;
  mapDetailsState.focusedRouteDisplay = null;
};

type FocusableFlight = {
  id: number;
  from?: { id: number } | null;
  to?: { id: number } | null;
};

export const isFocusedFlight = (flight: FocusableFlight) => {
  const selection = mapDetailsState.selection;
  if (selection?.type === 'flight') return flight.id === selection.flightId;
  if (selection?.type === 'route') {
    return routeMatchesEndpoints(
      flight.from?.id,
      flight.to?.id,
      selection.route,
    );
  }
  return false;
};

export const getFocusedRouteDisplay = (): RouteDisplayMode =>
  mapDetailsState.focusedRouteDisplay ?? mapPreferences.routeDisplay;

export const getFlightRouteDisplay = (
  flight: FocusableFlight,
): RouteDisplayMode =>
  isFocusedFlight(flight)
    ? getFocusedRouteDisplay()
    : mapPreferences.routeDisplay;

export const toggleFocusedRouteDisplay = () => {
  const selection = mapDetailsState.selection;
  if (selection?.type !== 'flight' && selection?.type !== 'route') return;
  const next = getFocusedRouteDisplay() === 'tracks' ? 'points' : 'tracks';
  mapDetailsState.focusedRouteDisplay =
    next === mapPreferences.routeDisplay ? null : next;
};

// Choosing a display in the map settings is explicit, so it also takes over
// from a toggle on the open pane. Otherwise the focused flight would ignore it.
export const setRouteDisplayPreference = (display: RouteDisplayMode) => {
  mapPreferences.routeDisplay = display;
  mapDetailsState.focusedRouteDisplay = null;
};

export const appConfig = $state<{
  config: ClientAppConfig | null;
  configured: DeepBoolean<FullAppConfig, boolean> | null;
  envConfigured: DeepBoolean<FullAppConfig, boolean> | null;
}>({
  config: null,
  configured: null,
  envConfigured: null,
});

export const flightScopeState = $state<{
  current: FlightScope;
}>({
  current: DEFAULT_FLIGHT_SCOPE,
});

export const setFlightScope = (scope: FlightScope) => {
  flightScopeState.current = scope;
};

export const versionState = $state<{
  currentVersion: string;
  latestVersion: string | null;
  newReleases: Array<{ name: string; body: string }>;
  isChecking: boolean;
  alreadyChecked: boolean;
}>({
  currentVersion: '',
  latestVersion: null,
  newReleases: [],
  isChecking: false,
  alreadyChecked: false,
});
