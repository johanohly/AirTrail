import type { FlightLookupDateKind } from '$lib/zod/flight';

// AeroDataBox indexes flights by scheduled date, so prefer it.
export const getLookupDate = (formData: {
  departure: string | null;
  departureScheduled: string | null;
}): { date: string; dateKind: FlightLookupDateKind } | null => {
  if (formData.departureScheduled) {
    return { date: formData.departureScheduled, dateKind: 'scheduled' };
  }
  if (formData.departure) {
    return { date: formData.departure, dateKind: 'actual' };
  }
  return null;
};
