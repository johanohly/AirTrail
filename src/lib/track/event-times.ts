import type { FlightTrackInput } from './schema';

import { decomposeToLocal, mergeTimeWithDate } from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

/** Exact zero is required: missing altitude is never a ground observation. */
export const detectTrackEventTimes = (track: FlightTrackInput) => {
  const takeoffs: number[] = [];
  const landings: number[] = [];
  const times = track.times;
  if (!times || times.length !== track.coordinates.length) {
    return { takeoff: null, landing: null };
  }
  for (let i = 1; i < times.length; i++) {
    const before = track.coordinates[i - 1]![2];
    const after = track.coordinates[i]![2];
    const gap = times[i]! - times[i - 1]!;
    if (gap <= 0 || gap > 3) continue;
    if (before === 0 && after !== undefined && after > 0)
      takeoffs.push(times[i]!);
    if (before !== undefined && before > 0 && after === 0)
      landings.push(times[i]!);
  }
  // Multiple transitions are ambiguous (for example, a go-around).
  const takeoff = takeoffs.length === 1 ? takeoffs[0]! : null;
  const landing = landings.length === 1 ? landings[0]! : null;
  if (takeoff !== null && landing !== null && landing <= takeoff) {
    return { takeoff: null, landing: null };
  }
  return { takeoff, landing };
};

export const prepareTrackEventTimes = (
  track: FlightTrackInput,
  form: FlightFormData,
) => {
  const events = detectTrackEventTimes(track);
  const warnings: string[] = [];
  const values: Partial<FlightFormData> = {};
  for (const departure of [true, false]) {
    const label = departure ? 'Departure' : 'Arrival';
    const event = departure ? events.takeoff : events.landing;
    const time = event ?? (departure ? track.times?.[0] : track.times?.at(-1));
    const date = departure ? form.departureScheduled : form.arrivalScheduled;
    const scheduledTime = departure
      ? form.departureScheduledTime
      : form.arrivalScheduledTime;
    const timezone = (departure ? form.from?.tz : form.to?.tz) ?? 'UTC';
    if (time !== undefined && time !== null && date && scheduledTime) {
      try {
        const scheduled = mergeTimeWithDate(date, scheduledTime, timezone);
        if (Math.abs(time * 1000 - scheduled.getTime()) > 24 * 60 * 60 * 1000) {
          warnings.push(
            `${label} track time differs from the original schedule by more than 24 hours. Check that this track belongs to this flight.`,
          );
        }
      } catch {
        // Incomplete or invalid schedule input cannot be compared yet.
      }
    }
    const dateField = departure ? 'takeoffActual' : 'landingActual';
    const timeField = departure ? 'takeoffActualTime' : 'landingActualTime';
    if (event !== null && !form[dateField] && !form[timeField]) {
      const local = decomposeToLocal(
        new Date(event * 1000).toISOString(),
        timezone,
        'en-GB',
      );
      values[dateField] = local.date;
      values[timeField] = local.time;
    }
  }
  return { values: warnings.length ? {} : values, warnings };
};
