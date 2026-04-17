import { z } from 'zod';

import { getDefaultAppMapStyleUrl } from '$lib/map/app-style';

export const oauthConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuerUrl: z.string().nullable(),
  clientId: z.string().nullable(),
  clientSecret: z.string().nullable(),
  scope: z.string().min(1).nullable(),
  autoRegister: z.boolean().nullable().default(true),
  autoLogin: z.boolean().nullable().default(false),
  hidePasswordForm: z.boolean().nullable().default(false),
  buttonText: z.string().nullable().default('Log in with SSO'),
});

export const integrationsConfigSchema = z.object({
  aeroDataBoxKey: z.string().nullable(),
});

export const mapConfigSchema = z.object({
  lightStyleUrl: z
    .string()
    .trim()
    .transform((v) => v || getDefaultAppMapStyleUrl('light')),
  darkStyleUrl: z
    .string()
    .trim()
    .transform((v) => v || getDefaultAppMapStyleUrl('dark')),
});

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
  }),
});
