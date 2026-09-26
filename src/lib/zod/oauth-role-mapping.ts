import { z } from 'zod';

export const oauthRoleMappingModeSchema = z.enum([
  'off',
  'on_create',
  'on_login',
]);

export const oauthRoleMappingSchema = z.object({
  name: z.string().trim().max(80).default(''),
  enabled: z.boolean().default(true),
  claimSource: z.enum(['userinfo', 'id_token']),
  claimPath: z.string().trim().startsWith('/'),
  operator: z.enum(['equals', 'contains']),
  claimValue: z.string().trim().min(1),
  roleId: z.string().min(1),
});

export const oauthClaimsSchema = z.record(z.string(), z.unknown());

export const oauthRoleMappingTestSchema = z.object({
  mappings: z.array(oauthRoleMappingSchema),
  userinfo: oauthClaimsSchema,
  idToken: oauthClaimsSchema,
});

export const oauthRoleMappingSettingsSchema = z.object({
  mode: oauthRoleMappingModeSchema,
  mappings: z.array(oauthRoleMappingSchema),
});

export type OAuthRoleMappingMode = z.infer<typeof oauthRoleMappingModeSchema>;
export type OAuthRoleMappingInput = z.infer<typeof oauthRoleMappingSchema>;
export type OAuthClaims = z.infer<typeof oauthClaimsSchema>;
