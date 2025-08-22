import { z } from 'zod';

export const aircraftSchema = z.object({
  icao: z
    .string({ message: 'Set an ICAO code' })
    .min(1, 'ICAO code is required')
    .max(4, 'ICAO code must be 4 characters or less')
    .regex(/^[A-Z0-9]+$/, 'ICAO code must contain only uppercase letters and numbers'),
  name: z.string().min(1, 'Aircraft name is required'),
});

/*
 * Used for flight schema and other aircraft references.
 */
export const flightAircraftSchema = z.object({
  icao: z
    .string()
    .refine((val) => val !== '', { message: 'Select an aircraft' }),
  name: z.string(),
});