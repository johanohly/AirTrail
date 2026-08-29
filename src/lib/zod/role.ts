import { z } from 'zod';

import { PERMISSIONS } from '$lib/authorization/permissions';

export const ROLE_NAME_MAX_LENGTH = 50;
export const ROLE_DESCRIPTION_MAX_LENGTH = 200;

export const permissionSchema = z.enum(PERMISSIONS);

export const roleInputSchema = z.object({
  name: z.string().trim().min(1).max(ROLE_NAME_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(ROLE_DESCRIPTION_MAX_LENGTH)
    .nullable()
    .optional(),
  permissions: z.array(permissionSchema),
});

export type RoleInput = z.infer<typeof roleInputSchema>;

export const roleUpdateSchema = roleInputSchema.extend({
  id: z.string().min(1),
});
