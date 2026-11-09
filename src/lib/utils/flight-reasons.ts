import { z } from 'zod';
import { FlightReasons } from '$lib/db/types';

export const customFlightReasonsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(
        (reason) =>
          !FlightReasons.some((builtin) => builtin === reason.toLowerCase()),
        'Built-in reasons are always available',
      ),
  )
  .max(50)
  .refine(
    (reasons) =>
      new Set(reasons.map((reason) => reason.toLowerCase())).size ===
      reasons.length,
    'Flight reasons must be unique',
  );

// Saved labels are kept verbatim, including reasons removed from settings.
export const flightReasonSchema = z.string().min(1).nullable();

export const flightReasonLabel = (reason: string): string =>
  FlightReasons.some((builtin) => builtin === reason)
    ? reason.charAt(0).toUpperCase() + reason.slice(1)
    : reason;

export const flightReasonOptions = (custom: readonly string[]) => [
  'leisure',
  'business',
  'crew',
  ...custom,
  'other',
];
