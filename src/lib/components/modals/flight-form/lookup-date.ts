import type { FlightLookupDateKind } from '$lib/zod/flight';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// AeroDataBox files flights under their scheduled date, so prefer it. A
// scheduled date more than a day from the departure is left over from an
// earlier lookup, and the departure the user just picked wins.
export const getLookupDate = (formData: {
  departure: string | null;
  departureScheduled: string | null;
}): { date: string; dateKind: FlightLookupDateKind } | null => {
  const { departure, departureScheduled } = formData;
  if (
    departureScheduled &&
    (!departure ||
      Math.abs(Date.parse(departure) - Date.parse(departureScheduled)) <=
        ONE_DAY_MS)
  ) {
    return { date: departureScheduled, dateKind: 'scheduled' };
  }
  if (departure) {
    return { date: departure, dateKind: 'actual' };
  }
  return null;
};
