import { z } from 'zod';

export const shareSchema = z.object({
  id: z.number().optional(),
  slug: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Share URL can only contain letters, numbers, hyphens, and underscores',
    )
    .min(1, 'Share URL is required')
    .max(50, 'Share URL must be 50 characters or less'),
  expiresAt: z.string().optional(),
  expiryOption: z
    .enum(['never', '1day', '1week', '1month', '3months', 'custom'])
    .default('never'),
  showMap: z.boolean().default(true),
  showStats: z.boolean().default(false),
  showFlightList: z.boolean().default(false),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  showFlightNumbers: z.boolean().default(true),
  showAirlines: z.boolean().default(true),
  showAircraft: z.boolean().default(false),
  showTimes: z.boolean().default(false),
  showDates: z.boolean().default(true),
});
