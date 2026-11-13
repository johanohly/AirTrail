import type { FlightTrackInput } from './schema';

import { decomposeToLocal, mergeTimeWithDate } from '$lib/utils/datetime';
import type { CreateFlight } from '$lib/db/types';
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

/*
 * The track is compared against the first complete date and time on each side,
 * from the gate schedule down to the runway times, so a flight entered with
 * only simple times is still checked.
 */
const COMPARISON_FIELDS = {
  departure: [
    'departureScheduled',
    'departure',
    'takeoffScheduled',
    'takeoffActual',
  ],
  arrival: ['arrivalScheduled', 'arrival', 'landingScheduled', 'landingActual'],
} as const;
type Side = keyof typeof COMPARISON_FIELDS;

const comparisonReference = (field: string) =>
  field.endsWith('Scheduled') ? 'the original schedule' : 'the entered time';

const findComparisonTime = (
  form: FlightFormData,
  side: Side,
  timezone: string,
) => {
  for (const field of COMPARISON_FIELDS[side]) {
    const date = form[field];
    const time = form[`${field}Time`];
    if (!date || !time) continue;
    try {
      return {
        at: mergeTimeWithDate(date, time, timezone).getTime(),
        reference: comparisonReference(field),
      };
    } catch {
      // Invalid time input is reported by the flight form itself.
      return null;
    }
  }
  return null;
};

type SideInput = {
  /** Null skips the side, as when the airport is unknown. */
  comparison: { at: number; reference: string } | null | undefined;
  /** True when the side already has a takeoff or landing value. */
  filled: boolean;
};

/*
 * The rules shared by the upload dialog and server-side track writes: compare
 * each side against the flight's own times, and fill only empty sides of a
 * day-precision flight. A mismatch on either side fills nothing.
 */
export const resolveTrackEventTimes = (
  track: FlightTrackInput,
  {
    datePrecision,
    sides,
  }: {
    datePrecision: string;
    sides: Record<Side, SideInput | null>;
  },
) => {
  const events = detectTrackEventTimes(track);
  const warnings: string[] = [];
  const filled: { takeoff?: number; landing?: number } = {};
  for (const departure of [true, false]) {
    const side = sides[departure ? 'departure' : 'arrival'];
    if (!side) continue;
    const label = departure ? 'Departure' : 'Arrival';
    const event = departure ? events.takeoff : events.landing;
    const time = event ?? (departure ? track.times?.[0] : track.times?.at(-1));
    const { comparison } = side;
    if (
      time !== undefined &&
      time !== null &&
      comparison &&
      Math.abs(time * 1000 - comparison.at) > 24 * 60 * 60 * 1000
    ) {
      warnings.push(
        `${label} track time differs from ${comparison.reference} by more than 24 hours. Check that this track belongs to this flight.`,
      );
    }
    if (datePrecision === 'day' && event !== null && !side.filled) {
      filled[departure ? 'takeoff' : 'landing'] = event;
    }
  }
  return { events: warnings.length ? {} : filled, warnings };
};

export const prepareTrackEventTimes = (
  track: FlightTrackInput,
  form: FlightFormData,
) => {
  const side = (departure: boolean): SideInput | null => {
    const timezone = (departure ? form.from : form.to)?.tz;
    if (!timezone) return null;
    const dateField = departure ? 'takeoffActual' : 'landingActual';
    const timeField = departure ? 'takeoffActualTime' : 'landingActualTime';
    return {
      comparison: findComparisonTime(
        form,
        departure ? 'departure' : 'arrival',
        timezone,
      ),
      filled: Boolean(form[dateField] || form[timeField]),
    };
  };
  const { events, warnings } = resolveTrackEventTimes(track, {
    datePrecision: form.datePrecision,
    sides: { departure: side(true), arrival: side(false) },
  });
  const values: Partial<FlightFormData> = {};
  for (const departure of [true, false]) {
    const event = departure ? events.takeoff : events.landing;
    const timezone = (departure ? form.from : form.to)?.tz;
    if (event === undefined || !timezone) continue;
    // The form stores canonical 24-hour times and formats them for display.
    // Browser locales can produce strings the time validator rejects.
    const local = decomposeToLocal(
      new Date(event * 1000).toISOString(),
      timezone,
      'fr-FR',
    );
    values[departure ? 'takeoffActual' : 'landingActual'] = local.date;
    values[departure ? 'takeoffActualTime' : 'landingActualTime'] = local.time;
  }
  return { values, warnings };
};

type StoredFlightTimes = Pick<
  CreateFlight,
  'datePrecision' | 'from' | 'to' | (typeof COMPARISON_FIELDS)[Side][number]
>;

/*
 * Server-side counterpart of `prepareTrackEventTimes` for flights whose times
 * are stored as UTC ISO strings, as the API, MCP and import write them.
 * Returns only the sides to fill, rounded down to the minute like the HH:MM
 * the upload dialog fills.
 */
export const fillTrackEventTimes = (
  track: FlightTrackInput,
  flight: StoredFlightTimes,
): { takeoffActual?: string; landingActual?: string } => {
  const side = (departure: boolean): SideInput | null => {
    if (!(departure ? flight.from : flight.to)) return null;
    const fields = COMPARISON_FIELDS[departure ? 'departure' : 'arrival'];
    const field = fields.find((name) => flight[name]);
    const at = field ? Date.parse(flight[field]!) : NaN;
    return {
      comparison:
        field && !Number.isNaN(at)
          ? {
              at,
              reference: comparisonReference(field),
            }
          : null,
      filled: Boolean(departure ? flight.takeoffActual : flight.landingActual),
    };
  };
  const { events } = resolveTrackEventTimes(track, {
    datePrecision: flight.datePrecision,
    sides: { departure: side(true), arrival: side(false) },
  });
  const toIso = (seconds: number) =>
    new Date((seconds - (seconds % 60)) * 1000).toISOString();
  return {
    ...(events.takeoff !== undefined && {
      takeoffActual: toIso(events.takeoff),
    }),
    ...(events.landing !== undefined && {
      landingActual: toIso(events.landing),
    }),
  };
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
