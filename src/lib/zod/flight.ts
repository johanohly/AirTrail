import { z } from 'zod';

export const addFlightSchema = z.object({
  from: z.string(),
  to: z.string(),
  departure: z
    .string()
    .datetime('Select a departure date')
    .optional()
    .refine((value) => value !== undefined),
  departureTime: z.string().optional(),
  arrival: z.string().datetime().optional(),
  arrivalTime: z.string().optional(),
});
