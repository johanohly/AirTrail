import type { FlightTrackInput } from './schema';

import { validateTrackTiming } from './validation';

import { decomposeToLocal } from '$lib/utils/datetime';
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
  const warnings = validateTrackTiming(track, form, events).map(
    (issue) => issue.message,
  );
  const values: Partial<FlightFormData> = {};
  for (const departure of [true, false]) {
    const event = departure ? events.takeoff : events.landing;
    const airport = departure ? form.from : form.to;
    if (!airport?.tz) continue;
    const timezone = airport.tz;
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
