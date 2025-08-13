import { z } from 'zod';

export const oauthConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuerUrl: z.string().nullable(),
  clientId: z.string().nullable(),
  clientSecret: z.string().nullable(),
  scope: z.string().min(1),
  autoRegister: z.boolean().default(true),
  autoLogin: z.boolean().default(false),
});

export const flightConfigSchema = z
  .object({
    // API Market (AeroDataBox) key. Keep server-only.
    apiMarketKey: z.string().nullable(),
  })
  .default({ apiMarketKey: null });

export const appConfigSchema = z.object({
  oauth: oauthConfigSchema,
  flight: flightConfigSchema,
});

export const clientAppConfigSchema = appConfigSchema.extend({
  oauth: appConfigSchema.shape.oauth.omit({ clientSecret: true }),
});
