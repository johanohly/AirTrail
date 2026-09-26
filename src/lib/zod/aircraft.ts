import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Date must be in YYYY-MM-DD format')
  .nullable();

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
  specific: z.boolean().default(false),
  typeId: z.number().nullable().default(null),
  serialNumber: z
    .string()
    .max(20, 'Serial number is too long')
    .nullable()
    .default(null),
  firstFlight: isoDate.default(null),
});
