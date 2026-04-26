import { z } from 'zod';

export const distanceUnitSchema = z.enum(['km', 'mi', 'nm']);
export const windSpeedUnitSchema = z.enum(['kt', 'mph', 'kmh', 'ms']);
export const temperatureUnitSchema = z.enum(['c', 'f']);
export const pressureUnitSchema = z.enum(['hpa', 'inhg']);
export const timeFormatSchema = z.enum(['12h', '24h', 'auto']);
export const dateFormatSchema = z.enum(['iso', 'us', 'eu', 'auto']);
export const weekStartsOnSchema = z.enum(['mon', 'sun', 'auto']);
export const flightTimeDisplaySchema = z.enum(['airport', 'utc', 'system']);

export type DistanceUnit = z.infer<typeof distanceUnitSchema>;
export type WindSpeedUnit = z.infer<typeof windSpeedUnitSchema>;
export type TemperatureUnit = z.infer<typeof temperatureUnitSchema>;
export type PressureUnit = z.infer<typeof pressureUnitSchema>;
export type TimeFormat = z.infer<typeof timeFormatSchema>;
export type DateFormat = z.infer<typeof dateFormatSchema>;
export type WeekStartsOn = z.infer<typeof weekStartsOnSchema>;
export type FlightTimeDisplay = z.infer<typeof flightTimeDisplaySchema>;

export const preferencesSchema = z.object({
  distanceUnit: distanceUnitSchema.default('km'),
  windSpeedUnit: windSpeedUnitSchema.default('kt'),
  temperatureUnit: temperatureUnitSchema.default('c'),
  pressureUnit: pressureUnitSchema.default('hpa'),
  timeFormat: timeFormatSchema.default('auto'),
  dateFormat: dateFormatSchema.default('auto'),
  weekStartsOn: weekStartsOnSchema.default('auto'),
  flightTimeDisplay: flightTimeDisplaySchema.default('airport'),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const updatePreferencesSchema = preferencesSchema.partial();
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;

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
  role: z.enum(['user', 'admin']).default('user'),
});

export const editUserSchema = userSchema.omit({ password: true, role: true });
export const adminEditUserSchema = userSchema
  .omit({ password: true })
  .extend({ id: z.string() });
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
