import { z } from 'zod';

export const aircraftSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'Aircraft name is required'),
  icao: z
    .string({ message: 'Set an ICAO code' })
    .max(4, 'ICAO code must be 4 characters or less')
    .regex(
      /^[A-Z0-9]+$/,
      'ICAO code must contain only uppercase letters and numbers',
    )
    .nullable(),
});
