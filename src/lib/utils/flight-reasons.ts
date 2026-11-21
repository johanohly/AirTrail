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

/*
 * Built-ins first, then the user's own reasons, then Other. A saved reason that
 * isn't in the list (removed since, or another passenger's) stays selectable.
 */
export const flightReasonOptions = (
  custom: readonly string[],
  current?: string | null,
) => {
  const own =
    current && !isBuiltinFlightReason(current) && !custom.includes(current)
      ? [...custom, current]
      : custom;
  return [
    ...FlightReasons.filter((reason) => reason !== 'other'),
    ...own,
    'other',
  ];
};
