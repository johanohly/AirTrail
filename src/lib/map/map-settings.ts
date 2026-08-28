import {
  mapConfigSchema,
  mapSettingsFormSchema,
  type MapConfig,
  type MapSettingsFormData,
} from '$lib/zod/config';

type PublicMapConfig = Omit<MapConfig, 'cartoApiKey' | 'protomapsApiKey'>;

export const toMapSettingsFormData = (
  config?: PublicMapConfig | MapConfig | null,
): MapSettingsFormData =>
  mapSettingsFormSchema.parse({
    provider: config?.provider ?? 'openfreemap',
    cartoApiKey: '',
    clearCartoApiKey: false,
    protomapsSourceKind: config?.protomapsSourceKind ?? 'hosted',
    protomapsApiKey: '',
    clearProtomapsApiKey: false,
    protomapsSourceUrl: config?.protomapsSourceUrl ?? '',
    protomapsMaxZoom: config?.protomapsMaxZoom ?? 15,
    protomapsAssetsBaseUrl: config?.protomapsAssetsBaseUrl,
    protomapsLanguage: config?.protomapsLanguage,
    lightStyleUrl: config?.lightStyleUrl ?? '',
    darkStyleUrl: config?.darkStyleUrl ?? '',
  });

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
    styleRevision: current.styleRevision + 1,
  });
};
