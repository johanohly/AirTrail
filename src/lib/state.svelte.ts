import {
  normalizeRoute,
  type Route,
} from '$lib/components/flight-filters/types';
import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
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
  | { type: 'route'; route: Route };

export const mapDetailsState = $state<{
  selection: MapDetailsSelection | null;
  focusRequest: number;
}>({
  selection: null,
  focusRequest: 0,
});

export const airportDetailsState = $state<{
  airportId: number | null;
  focusRequest: number;
}>({
  airportId: null,
  focusRequest: 0,
});

const syncAirportDetailsCompatibility = () => {
  airportDetailsState.airportId =
    mapDetailsState.selection?.type === 'airport'
      ? mapDetailsState.selection.airportId
      : null;
  airportDetailsState.focusRequest = mapDetailsState.focusRequest;
};

export const openAirportDetails = (airportId: number) => {
  mapDetailsState.selection = { type: 'airport', airportId };
  mapDetailsState.focusRequest += 1;
  syncAirportDetailsCompatibility();
};

export const openRouteDetails = (route: Route) => {
  mapDetailsState.selection = {
    type: 'route',
    route: normalizeRoute(route.a, route.b),
  };
  mapDetailsState.focusRequest += 1;
  syncAirportDetailsCompatibility();
};

export const focusMapDetails = () => {
  if (!mapDetailsState.selection) return;
  mapDetailsState.focusRequest += 1;
  syncAirportDetailsCompatibility();
};

export const closeMapDetails = () => {
  mapDetailsState.selection = null;
  syncAirportDetailsCompatibility();
};

export const closeAirportDetails = closeMapDetails;

export const appConfig = $state<{
  config: ClientAppConfig | null;
  configured: DeepBoolean<FullAppConfig, boolean> | null;
  envConfigured: DeepBoolean<FullAppConfig, boolean> | null;
}>({
  config: null,
  configured: null,
  envConfigured: null,
});

export type FlightScope = 'mine' | 'user' | 'all';

export const flightScopeState = $state<{
  scope: FlightScope;
  userId: string | undefined;
}>({
  scope: 'mine',
  userId: undefined,
});

export const setFlightScope = (scope: FlightScope, userId?: string) => {
  flightScopeState.scope = scope;
  flightScopeState.userId = userId;
};

export const versionState = $state<{
  currentVersion: string;
  latestVersion: string | null;
  newReleases: Array<{ name: string; body: string }>;
  isChecking: boolean;
  alreadyChecked: boolean;
  dismissedVersion: string | null;
}>({
  currentVersion: '',
  latestVersion: null,
  newReleases: [],
  isChecking: false,
  alreadyChecked: false,
  dismissedVersion: null,
});
