import type { ClientAppConfig, FullAppConfig } from '$lib/server/utils/config';
import type { DeepBoolean } from '$lib/utils';

export const openModalsState = $state({
  addFlight: false,
  listFlights: false,
  statistics: false,
  settings: false,
});

export const appConfig = $state<{
  config: ClientAppConfig | null;
  envConfigured: DeepBoolean<FullAppConfig, boolean> | null;
}>({
  config: null,
  envConfigured: null,
});
