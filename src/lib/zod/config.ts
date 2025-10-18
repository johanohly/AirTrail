import { z } from 'zod';

export const oauthConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuerUrl: z.string().nullable(),
  clientId: z.string().nullable(),
  clientSecret: z.string().nullable(),
  scope: z.string().min(1).nullable(),
  autoRegister: z.boolean().nullable().default(true),
  autoLogin: z.boolean().nullable().default(false),
  hidePasswordForm: z.boolean().nullable().default(false),
});

export const integrationsConfigSchema = z.object({
  // AeroDataBox (via RapidAPI) key. Keep server-only.
  aeroDataBoxKey: z.string().nullable(),
});

export const appConfigSchema = z.object({
  oauth: oauthConfigSchema,
  integrations: integrationsConfigSchema,
});

export const clientAppConfigSchema = appConfigSchema.extend({
  oauth: appConfigSchema.shape.oauth.omit({ clientSecret: true }),
  integrations: appConfigSchema.shape.integrations.omit({
    aeroDataBoxKey: true,
  }),
});
