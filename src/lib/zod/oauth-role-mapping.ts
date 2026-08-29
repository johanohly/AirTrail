import { z } from 'zod';

export const oauthRoleMappingModeSchema = z.enum([
  'off',
  'on_create',
  'on_login',
]);

export const oauthRoleMappingSchema = z.object({
  claimSource: z.enum(['userinfo', 'id_token']),
  claimPath: z.string().trim().startsWith('/'),
  operator: z.enum(['equals', 'contains']),
  claimValue: z.string().min(1),
  roleId: z.string().min(1),
});

export const oauthRoleMappingSettingsSchema = z.object({
  mode: oauthRoleMappingModeSchema,
  mappings: z.array(oauthRoleMappingSchema),
});

export type OAuthRoleMappingMode = z.infer<typeof oauthRoleMappingModeSchema>;
export type OAuthRoleMappingInput = z.infer<typeof oauthRoleMappingSchema>;
