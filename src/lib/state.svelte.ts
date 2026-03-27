import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
import type { DeepBoolean } from '$lib/utils';

export const flightAddedState = $state({
  added: false,
});

export type SettingsTabId =
  | 'general'
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
