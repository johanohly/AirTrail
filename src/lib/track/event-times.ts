import type { FlightTrackInput } from './schema';

import { decomposeToLocal, mergeTimeWithDate } from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

const MAX_TRANSITION_GAP_SECONDS = 60;

/** Prefer explicit ground state; otherwise require an exact-zero altitude. */
export const detectTrackEventTimes = (track: FlightTrackInput) => {
  const times = track.times;
  const points = track.coordinates;
  if (!times || times.length !== points.length) {
    return { takeoff: null, landing: null };
  }
  const isAirborne = (i: number) =>
    track.ground ? track.ground[i] === false : (points[i]![2] ?? 0) > 0;
  const isGrounded = (i: number) =>
    track.ground ? track.ground[i] === true : points[i]![2] === 0;
  const isTransition = (airborne: number, grounded: number) => {
    if (!isGrounded(grounded)) return false;
    const gap = Math.abs(times[airborne]! - times[grounded]!);
    return gap > 0 && gap <= MAX_TRANSITION_GAP_SECONDS;
  };

  // A track is one flight leg, so only the outermost airborne points count.
  // Touch-and-goes in between are neither the takeoff nor the landing.
  const first = points.findIndex((_, i) => isAirborne(i));
  const last = points.findLastIndex((_, i) => isAirborne(i));
  if (first === -1) return { takeoff: null, landing: null };
  return {
    takeoff: first > 0 && isTransition(first, first - 1) ? times[first]! : null,
    landing:
      last < points.length - 1 && isTransition(last, last + 1)
        ? times[last + 1]!
        : null,
  };
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
    const airport = departure ? form.from : form.to;
    if (!airport?.tz) continue;
    const timezone = airport.tz;
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
    if (
      form.datePrecision === 'day' &&
      event !== null &&
      !form[dateField] &&
      !form[timeField]
    ) {
      // The form stores canonical 24-hour times and formats them for display.
      // Browser locales can produce strings the time validator rejects.
      const local = decomposeToLocal(
        new Date(event * 1000).toISOString(),
        timezone,
        'fr-FR',
      );
      values[dateField] = local.date;
      values[timeField] = local.time;
    }
  }
  return { values: warnings.length ? {} : values, warnings };
};

/** Clear only complete pairs that still match this upload's autofilled values. */
export const clearTrackEventTimes = (
  form: FlightFormData,
  filledTimes: Partial<FlightFormData>,
): Partial<FlightFormData> => {
  const values: Partial<FlightFormData> = {};
  for (const [dateField, timeField] of [
    ['takeoffActual', 'takeoffActualTime'],
    ['landingActual', 'landingActualTime'],
  ] as const) {
    if (
      filledTimes[dateField] &&
      filledTimes[timeField] &&
      form[dateField] === filledTimes[dateField] &&
      form[timeField] === filledTimes[timeField]
    ) {
      values[dateField] = null;
      values[timeField] = null;
    }
  }
  return values;
};
