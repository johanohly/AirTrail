import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
import type { DeepBoolean } from '$lib/utils';

export const flightAddedState = $state({
  added: false,
});

export const openModalsState = $state({
  addFlight: false,
  listFlights: false,
  statistics: false,
  settings: false,
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
