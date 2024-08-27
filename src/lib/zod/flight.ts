import { z } from 'zod';

export const addFlightSchema = z.object({
  from: z.string().min(1, 'Select a departure'),
  to: z.string().min(1, 'Select a destination'),
  departure: z
    .string()
    .datetime('Select a departure date')
    .optional()
    .refine((value) => value !== undefined, 'Select a departure date'),
  departureTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^$/, "Must be in 'HH:MM' format") // |^$ is for empty string in the case where the user deletes the input
    .optional(),
  arrival: z.string().datetime('Select an arrival date').optional(),
  arrivalTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^$/, "Must be in 'HH:MM' format")
    .optional(),
});
