import { z } from 'zod';

export const REMINDER_OFFSETS = [30, 60, 120, 180, 1440] as const;

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/** Applied when a feed is enabled and the user has not chosen yet. */
export const DEFAULT_REMINDER_OFFSET: ReminderOffset = 120;

export const calendarUpdateSchema = z.object({
  /** Minutes before departure, or null for no reminder. */
  reminderOffsetMinutes: z.union([
    z.literal(30),
    z.literal(60),
    z.literal(120),
    z.literal(180),
    z.literal(1440),
    z.null(),
  ]),
  showEmoji: z.boolean(),
});

export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
