const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/*
 * AeroDataBox files a flight under its scheduled date, so a flight delayed
 * past midnight is only found by that date. A delay only moves the departure
 * later, so a scheduled date after the departure, or more than a day before
 * it, doesn't belong to it (the user moved the departure after an earlier
 * lookup), and the departure wins.
 */
export const getLookupDate = (formData: {
  departure: string | null;
  departureScheduled: string | null;
}): string | null => {
  const { departure, departureScheduled } = formData;
  if (!departureScheduled) return departure;
  if (!departure) return departureScheduled;

  const delay = Date.parse(departure) - Date.parse(departureScheduled);
  return delay >= 0 && delay <= ONE_DAY_MS ? departureScheduled : departure;
};
