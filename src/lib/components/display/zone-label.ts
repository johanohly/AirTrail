export const offsetLabel = (tz: string, at: Date): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
    if (raw === 'UTC' || raw === 'GMT' || raw.startsWith('GMT')) return raw;
    if (/^[+-]\d/.test(raw)) return `GMT${raw}`;
    return raw;
  } catch {
    return tz;
  }
};

/* The badge the time tooltip shows for `tz`, so text elsewhere in the tooltip
 * can name the same zone as the matching row. */
export const zoneLabel = (
  tz: string,
  at: Date,
  airport: { tz: string | null; label: string | null },
): string => {
  if (tz === 'UTC') return 'UTC';
  if (tz === airport.tz) return airport.label ?? offsetLabel(tz, at);
  return offsetLabel(tz, at);
};
