import { z } from 'zod';

import { FlightReasons } from '$lib/db/types';
import { toTitleCase } from '$lib/utils/string';

export type BuiltinFlightReason = (typeof FlightReasons)[number];

export const isBuiltinFlightReason = (
  reason: string,
): reason is BuiltinFlightReason =>
  FlightReasons.some((builtin) => builtin === reason);

export const customFlightReasonsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(
        (reason) => !isBuiltinFlightReason(reason.toLowerCase()),
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

// Saved reasons are kept verbatim, including ones removed from settings.
export const flightReasonSchema = z.string().min(1).max(100).nullable();

export const flightReasonLabel = (reason: string): string =>
  isBuiltinFlightReason(reason) ? toTitleCase(reason) : reason;

/** Built-ins first, the user's own reasons next, and Other last. */
export const flightReasonOptions = (custom: readonly string[]) => [
  ...FlightReasons.filter((reason) => reason !== 'other'),
  ...custom,
  'other',
];
