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
