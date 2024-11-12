import { z } from 'zod';

import { userSchema } from '$lib/zod/user';

export const signUpSchema = userSchema.omit({ role: true });

export const signInSchema = z.object({
  username: z.string(),
  password: z.string(),
});
