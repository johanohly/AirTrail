import { z } from 'zod';

export const userSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters long' })
    .max(20, { message: 'Username must be at most 20 characters long' })
    .regex(/^\w+$/, {
      message: 'Username can only contain letters, numbers, and underscores',
    }),
  password: z.string().min(8),
  displayName: z.string().min(3),
  unit: z
    .enum(['imperial', 'metric'], { message: 'Select a unit' })
    .default('metric'),
  role: z.enum(['user', 'admin']).default('user'),
});

export const editUserSchema = userSchema.omit({ password: true, role: true });
export const editPasswordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Must be at least 8 characters long'),
    newPassword: z.string().min(8, 'Must be at least 8 characters long'),
    confirmPassword: z.string(),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
    if (newPassword !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
    if (newPassword && currentPassword === newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password must be different from current password',
        path: ['newPassword'],
      });
    }
  });

export const addUserSchema = userSchema;

export const createApiKeySchema = z.object({
  name: z.string(),
});
