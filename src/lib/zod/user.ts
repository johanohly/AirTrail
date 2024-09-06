import { z } from 'zod';
import { signUpSchema as addUserPrimitive } from '$lib/zod/auth';

const addUserExtras = z.object({
  role: z.enum(['user', 'admin']).default('user'),
});

export const addUserSchema = addUserPrimitive.merge(addUserExtras);
