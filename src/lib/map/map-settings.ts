import {
  DEFAULT_MAP_CONFIG,
  mapConfigSchema,
  mapSettingsFormSchema,
  type MapConfig,
  type MapSettingsFormData,
} from '$lib/zod/config';

export type PublicMapConfig = Omit<
  MapConfig,
  'cartoApiKey' | 'protomapsApiKey'
>;

export type MapCredentialState = {
  cartoApiKey: boolean;
  protomapsApiKey: boolean;
};

const configuredCredential = (
  config: PublicMapConfig | MapConfig,
  key: 'cartoApiKey' | 'protomapsApiKey',
  fallback: boolean,
) => {
  switch (key) {
    case 'cartoApiKey':
      return 'cartoApiKey' in config ? !!config.cartoApiKey : fallback;
    case 'protomapsApiKey':
      return 'protomapsApiKey' in config ? !!config.protomapsApiKey : fallback;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
};

const credentialChange = ({
  clear,
  configured,
  current,
  submitted,
}: {
  clear: boolean;
  configured: boolean;
  current?: string | null;
  submitted: string;
}) => {
  if (clear) return configured;
  if (!submitted) return false;
  return current === undefined || submitted !== current;
};

const comparableMapSettings = (config: MapConfig) => {
  const {
    cartoApiKey: _cartoApiKey,
    protomapsApiKey: _protomapsApiKey,
    styleRevision: _styleRevision,
    ...settings
  } = config;
  return JSON.stringify(settings);
};

export const mapConfigsHaveSameSettings = (
  first: MapConfig,
  second: MapConfig,
) => {
  const { styleRevision: _firstRevision, ...firstSettings } = first;
  const { styleRevision: _secondRevision, ...secondSettings } = second;
  return JSON.stringify(firstSettings) === JSON.stringify(secondSettings);
};

export const toMapSettingsFormData = (
  config?: PublicMapConfig | MapConfig | null,
): MapSettingsFormData => {
  const current = config ?? DEFAULT_MAP_CONFIG;

  return mapSettingsFormSchema.parse({
    provider: current.provider,
    cartoApiKey: '',
    clearCartoApiKey: false,
    protomapsSourceKind: current.protomapsSourceKind,
    protomapsApiKey: '',
    clearProtomapsApiKey: false,
    protomapsSourceUrl: current.protomapsSourceUrl ?? '',
    protomapsMaxZoom: current.protomapsMaxZoom,
    protomapsAssetsBaseUrl: current.protomapsAssetsBaseUrl,
    protomapsLanguage: current.protomapsLanguage,
    lightStyleUrl: current.lightStyleUrl ?? '',
    darkStyleUrl: current.darkStyleUrl ?? '',
  });
};

export const mergeMapSettings = (
  current: MapConfig,
  submitted: MapSettingsFormData,
): MapConfig => {
  const usesSubmittedProtomapsConfig = submitted.provider === 'protomaps';
  const protomapsSourceKind = usesSubmittedProtomapsConfig
    ? submitted.protomapsSourceKind
    : current.protomapsSourceKind;

  return mapConfigSchema.parse({
    provider: submitted.provider,
    cartoApiKey: submitted.clearCartoApiKey
      ? null
      : submitted.cartoApiKey || current.cartoApiKey,
    protomapsSourceKind,
    protomapsApiKey: submitted.clearProtomapsApiKey
      ? null
      : submitted.protomapsApiKey || current.protomapsApiKey,
    protomapsSourceUrl:
      usesSubmittedProtomapsConfig && protomapsSourceKind !== 'hosted'
        ? submitted.protomapsSourceUrl || null
        : current.protomapsSourceUrl,
    protomapsMaxZoom:
      usesSubmittedProtomapsConfig && protomapsSourceKind === 'zxy'
        ? submitted.protomapsMaxZoom
        : current.protomapsMaxZoom,
    protomapsAssetsBaseUrl: usesSubmittedProtomapsConfig
      ? submitted.protomapsAssetsBaseUrl
      : current.protomapsAssetsBaseUrl,
    protomapsLanguage: usesSubmittedProtomapsConfig
      ? submitted.protomapsLanguage
      : current.protomapsLanguage,
    lightStyleUrl: submitted.lightStyleUrl || null,
    darkStyleUrl: submitted.darkStyleUrl || null,
    styleRevision: current.styleRevision,
  });
};

export const hasMapSettingsChanges = (
  current: PublicMapConfig | MapConfig,
  submitted: unknown,
  credentialState: MapCredentialState = {
    cartoApiKey: false,
    protomapsApiKey: false,
  },
) => {
  const parsed = mapSettingsFormSchema.safeParse(submitted);
  if (!parsed.success) return true;

  const cartoApiKeyConfigured = configuredCredential(
    current,
    'cartoApiKey',
    credentialState.cartoApiKey,
  );
  const protomapsApiKeyConfigured = configuredCredential(
    current,
    'protomapsApiKey',
    credentialState.protomapsApiKey,
  );
  const currentCartoApiKey =
    'cartoApiKey' in current ? current.cartoApiKey : undefined;
  const currentProtomapsApiKey =
    'protomapsApiKey' in current ? current.protomapsApiKey : undefined;

  if (
    credentialChange({
      clear: parsed.data.clearCartoApiKey,
      configured: cartoApiKeyConfigured,
      current: currentCartoApiKey,
      submitted: parsed.data.cartoApiKey,
    }) ||
    credentialChange({
      clear: parsed.data.clearProtomapsApiKey,
      configured: protomapsApiKeyConfigured,
      current: currentProtomapsApiKey,
      submitted: parsed.data.protomapsApiKey,
    })
  ) {
    return true;
  }

  const currentWithRedactedCredentials = mapConfigSchema.parse({
    ...current,
    cartoApiKey: null,
    protomapsApiKey: null,
  });
  const merged = mergeMapSettings(currentWithRedactedCredentials, {
    ...parsed.data,
    clearCartoApiKey: false,
    clearProtomapsApiKey: false,
  });

  return (
    comparableMapSettings(currentWithRedactedCredentials) !==
    comparableMapSettings(merged)
  );
};
