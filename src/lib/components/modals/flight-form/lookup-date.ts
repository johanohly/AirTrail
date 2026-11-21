const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/*
 * AeroDataBox files a flight under its scheduled date, so a flight delayed
 * past midnight is only found by that date. A scheduled date more than a day
 * from the departure doesn't belong to it (the user moved the departure after
 * an earlier lookup), so the departure wins then.
 */
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
