import { z } from 'zod';

export const airlineSchema = z.object({
  id: z.number().nullable(),
  name: z.string().min(1, 'Airline name is required'),
  icao: z
    .string({ message: 'Set an ICAO code' })
    .max(3, 'ICAO code must be 3 characters or less')
    .regex(
      /^[A-Z0-9]+$/,
      'ICAO code must contain only uppercase letters and numbers',
    )
    .nullable(),
  iata: z
    .string({ message: 'Set an IATA code' })
    .max(2, 'IATA code must be 2 characters or less')
    .regex(
      /^[A-Z0-9]+$/,
      'IATA code must contain only uppercase letters and numbers',
    )
    .nullable(),
});
