import { z } from 'zod';

// |^$ is for empty string in the case where the user deletes the input
const timeRegex24 = /^([01]?[0-9]|2[0-3]):[0-5][0-9](?:\s?(?:am|pm))?$|^$/;
const timeRegex12 = /^\d{1,2}:\d{2}\s?(?:am|pm)$/;

export const addFlightSchema = z.object({
  from: z.string(),
  to: z.string(),
  duration: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, 'Invalid duration')
    .optional(),
  departure: z
    .string()
    .datetime('Select a departure date')
    .optional()
    .refine((value) => value !== undefined, 'Select a departure date'),
  departureTime: z
    .string()

    .optional(),
  arrival: z.string().datetime('Select an arrival date').optional(),
  arrivalTime: z
    .string()
    .refine((value) => timeRegex24.test(value), 'Invalid 24-hour format')
    .refine((value) => {
      if (timeRegex12.test(value)) {
        return /^([1-9]|1[0-2]):[0-5][0-9]\s?(?:am|pm)$/.test(value);
      }
      return true; // If it's not in 12-hour format, just return true (it'll be caught by the previous refine)
    }, 'Invalid 12-hour format')
    .optional(),
});
