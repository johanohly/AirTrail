const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// AeroDataBox files flights under their scheduled date, so prefer it. A
// scheduled date more than a day from the departure is left over from an
// earlier lookup, and the departure the user just picked wins.
export const getLookupDate = (formData: {
  departure: string | null;
  departureScheduled: string | null;
}): string | null => {
  const { departure, departureScheduled } = formData;
  if (
    departureScheduled &&
    (!departure ||
      Math.abs(Date.parse(departure) - Date.parse(departureScheduled)) <=
        ONE_DAY_MS)
  ) {
    return departureScheduled;
  }
  return departure;
};
