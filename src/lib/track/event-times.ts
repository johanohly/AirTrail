import type { FlightTrackInput } from './schema';

import { decomposeToLocal, mergeTimeWithDate } from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

/** Prefer explicit ground state; otherwise require an exact-zero altitude. */
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
    if (gap <= 0 || gap > 60) continue;
    if (track.ground !== undefined) {
      const wasGround = track.ground[i - 1];
      const isGround = track.ground[i];
      if (wasGround === true && isGround === false) takeoffs.push(times[i]!);
      if (wasGround === false && isGround === true) landings.push(i);
      continue;
    }
    if (before === 0 && after !== undefined && after > 0)
      takeoffs.push(times[i]!);
    if (before !== undefined && before > 0 && after === 0) landings.push(i);
  }
  // A selected track represents one flight leg, possibly with touch-and-goes.
  const takeoff = takeoffs[0] ?? null;
  const landingIndex = landings.at(-1);
  const lastAirborneIndex = track.coordinates.findLastIndex((coordinate, i) =>
    track.ground !== undefined
      ? track.ground[i] === false
      : coordinate[2] !== undefined && coordinate[2] > 0,
  );
  // Do not mistake a touch-and-go for the final landing, even if its later
  // liftoff or touchdown falls outside the permitted transition gap.
  const landing =
    landingIndex !== undefined &&
    landingIndex > lastAirborneIndex &&
    (takeoff === null || times[landingIndex]! > takeoff)
      ? times[landingIndex]!
      : null;
  return { takeoff, landing };
};

export const prepareTrackEventTimes = (
  track: FlightTrackInput,
  form: FlightFormData,
  locale = Intl.DateTimeFormat().resolvedOptions().locale,
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
    if (event !== null && !form[dateField] && !form[timeField]) {
      const local = decomposeToLocal(
        new Date(event * 1000).toISOString(),
        timezone,
        locale,
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
