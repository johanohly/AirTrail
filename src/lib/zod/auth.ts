import { z } from 'zod';

import { preferencesSchema, userSchema } from '$lib/zod/user';

export const signUpSchema = userSchema
  .omit({ role: true })
  .merge(preferencesSchema);

export const signInSchema = z.object({
  username: z.string(),
  password: z.string(),
});
