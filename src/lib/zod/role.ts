import { z } from 'zod';

import { PERMISSIONS } from '$lib/authorization/permissions';

export const permissionSchema = z.enum(PERMISSIONS);

export const roleInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).nullable().optional(),
  permissions: z.array(permissionSchema),
});

export const roleUpdateSchema = roleInputSchema.extend({
  id: z.string().min(1),
});
