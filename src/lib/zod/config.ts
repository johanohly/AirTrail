import { z } from 'zod';

import { MAP_PROVIDERS, PROTOMAPS_SOURCE_KINDS } from '$lib/map/basemap';

export const DEFAULT_PROTOMAPS_ASSETS_BASE_URL =
  'https://protomaps.github.io/basemaps-assets';

const nullableTrimmedString = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((value) => value || null);

const mapResourceBaseUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (value.startsWith('/')) {
      return value.length > 1 && !value.startsWith('//');
    }

    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Use an HTTP(S) URL or a root-relative path.');

const emptyFormValueToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value;

const customMapStyleUrl = z.preprocess((value) => {
  if (
    typeof value === 'string' &&
    value.startsWith('/api/map-styles/airport/style.json?')
  ) {
    return null;
  }
  return value;
}, nullableTrimmedString);

export const oauthConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuerUrl: z.string().nullable(),
  clientId: z.string().nullable(),
  clientSecret: z.string().nullable(),
  tokenEndpointAuthMethod: z
    .enum(['client_secret_post', 'client_secret_basic'])
    .default('client_secret_post'),
  scope: z
    .string()
    .min(1)
    .nullable()
    .default('openid profile')
    .transform((value) => value ?? 'openid profile'),
  prompt: z.string().nullable().default(null),
  autoRegister: z.boolean().nullable().default(true),
  autoLogin: z.boolean().nullable().default(false),
  hidePasswordForm: z.boolean().nullable().default(false),
  buttonText: z.string().nullable().default('Log in with SSO'),
});

export const integrationsConfigSchema = z.object({
  aeroDataBoxKey: z.string().nullable(),
  openAipKey: z.string().nullable(),
});

export const mapConfigSchema = z.object({
  provider: z.enum(MAP_PROVIDERS).default('openfreemap'),
  cartoApiKey: nullableTrimmedString,
  protomapsSourceKind: z.enum(PROTOMAPS_SOURCE_KINDS).default('hosted'),
  protomapsApiKey: nullableTrimmedString,
  protomapsSourceUrl: nullableTrimmedString,
  protomapsMaxZoom: z.coerce.number().int().min(0).max(24).default(15),
  protomapsAssetsBaseUrl: mapResourceBaseUrl
    .default(DEFAULT_PROTOMAPS_ASSETS_BASE_URL)
    .transform((value) => value.replace(/\/+$/, '')),
  protomapsLanguage: z.string().trim().min(2).max(16).default('en'),
  lightStyleUrl: customMapStyleUrl,
  darkStyleUrl: customMapStyleUrl,
  styleRevision: z.coerce.number().int().nonnegative().default(0),
});
export type MapConfig = z.infer<typeof mapConfigSchema>;
export const DEFAULT_MAP_CONFIG: Readonly<MapConfig> = Object.freeze(
  mapConfigSchema.parse({}),
);

export const mapSettingsFormSchema = z.object({
  provider: z.enum(MAP_PROVIDERS),
  cartoApiKey: z.string().trim().default(''),
  clearCartoApiKey: z.boolean().default(false),
  protomapsSourceKind: z
    .enum(PROTOMAPS_SOURCE_KINDS)
    .default(DEFAULT_MAP_CONFIG.protomapsSourceKind),
  protomapsApiKey: z.string().trim().default(''),
  clearProtomapsApiKey: z.boolean().default(false),
  protomapsSourceUrl: z.string().trim().default(''),
  protomapsMaxZoom: z.preprocess(
    emptyFormValueToUndefined,
    z.coerce
      .number()
      .int()
      .min(0)
      .max(24)
      .default(DEFAULT_MAP_CONFIG.protomapsMaxZoom),
  ),
  protomapsAssetsBaseUrl: z.preprocess(
    emptyFormValueToUndefined,
    mapResourceBaseUrl.default(DEFAULT_MAP_CONFIG.protomapsAssetsBaseUrl),
  ),
  protomapsLanguage: z.preprocess(
    emptyFormValueToUndefined,
    z
      .string()
      .trim()
      .min(2)
      .max(16)
      .default(DEFAULT_MAP_CONFIG.protomapsLanguage),
  ),
  lightStyleUrl: z.string().trim().default(''),
  darkStyleUrl: z.string().trim().default(''),
});
export type MapSettingsFormData = z.infer<typeof mapSettingsFormSchema>;

export const dataConfigSchema = z.object({
  lastSynced: z.string().nullable(),
});

export const appConfigSchema = z.object({
  oauth: oauthConfigSchema,
  integrations: integrationsConfigSchema,
  map: mapConfigSchema,
  data: dataConfigSchema,
});

export const clientAppConfigSchema = appConfigSchema.extend({
  oauth: appConfigSchema.shape.oauth.omit({ clientSecret: true }),
  integrations: appConfigSchema.shape.integrations.omit({
    aeroDataBoxKey: true,
    openAipKey: true,
  }),
  map: appConfigSchema.shape.map.omit({
    cartoApiKey: true,
    protomapsApiKey: true,
  }),
});
