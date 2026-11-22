import { TZDate } from '@date-fns/tz';

import type { FlightTrackInput } from './schema';

import type { CreateFlight } from '$lib/db/types';
import { mergeTimeWithDate } from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

const MAX_TRANSITION_GAP_SECONDS = 60;

type EventTrack = Pick<FlightTrackInput, 'coordinates' | 'times' | 'ground'>;

/** Prefer explicit ground state; otherwise require an exact-zero altitude. */
const airborneAt = (track: EventTrack) => (i: number) =>
  track.ground
    ? track.ground[i] === false
    : (track.coordinates[i]?.[2] ?? 0) > 0;

export const detectTrackEventTimes = (track: EventTrack) => {
  const times = track.times;
  const points = track.coordinates;
  if (!times || times.length !== points.length) {
    return { takeoff: null, landing: null };
  }
  const isAirborne = airborneAt(track);
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

type FlightSide = keyof typeof COMPARISON_FIELDS;
type ComparisonField = (typeof COMPARISON_FIELDS)[FlightSide][number];

/** The flight a track is checked against, with its times as instants. */
type TrackEventFlight = {
  datePrecision: FlightFormData['datePrecision'];
  departureTz: string | null | undefined;
  arrivalTz: string | null | undefined;
  /** Missing or null when not set; an invalid date stops the comparison. */
  times: Partial<Record<ComparisonField, Date | null>>;
};

export type TrackEventSkipReason =
  /** The track is more than 24 hours from the flight's times. */
  | 'mismatch'
  /** Only flights with an exact date get runway times. */
  | 'inexact-date'
  | 'no-airport'
  | 'no-times'
  /** The track starts (takeoff) or ends (landing) in the air. */
  | 'in-air'
  | 'not-detected';

export type TrackEventTime =
  { at: TZDate; reason: null } | { at: null; reason: TrackEventSkipReason };

export type TrackEventMismatch = {
  side: FlightSide;
  reference: 'the original schedule' | 'the entered time';
};

export type TrackEventTimes = {
  takeoffActual: TrackEventTime;
  landingActual: TrackEventTime;
  mismatches: TrackEventMismatch[];
};

const findComparisonTime = (flight: TrackEventFlight, side: FlightSide) => {
  for (const field of COMPARISON_FIELDS[side]) {
    const time = flight.times[field];
    if (!time) continue;
    // Invalid time input is reported by the flight form itself.
    if (Number.isNaN(time.getTime())) return null;
    return {
      at: time.getTime(),
      reference: field.endsWith('Scheduled')
        ? ('the original schedule' as const)
        : ('the entered time' as const),
    };
  }
  return null;
};

/*
 * The rules the flight form and the server share for runway times from a
 * track, so the two can't drift apart. Takeoff and landing are detected in
 * each airport's timezone and rounded down to the minute, only for flights
 * with an exact date, and neither is filled when either end of the track is
 * more than 24 hours from the flight's times. Existing takeoff and landing
 * values are not considered here; the caller decides how to merge them.
 */
const resolveTrackEventTimes = (
  track: EventTrack,
  flight: TrackEventFlight,
): TrackEventTimes => {
  const events = detectTrackEventTimes(track);
  const mismatches: TrackEventMismatch[] = [];
  const reasons: Record<FlightSide, TrackEventSkipReason | null> = {
    departure: null,
    arrival: null,
  };
  const detected: Record<FlightSide, TZDate | null> = {
    departure: null,
    arrival: null,
  };
  const airborne = airborneAt(track);
  const lastIndex = track.coordinates.length - 1;
  for (const side of ['departure', 'arrival'] as const) {
    const departure = side === 'departure';
    const event = departure ? events.takeoff : events.landing;
    const time = event ?? (departure ? track.times?.[0] : track.times?.at(-1));
    const timezone = departure ? flight.departureTz : flight.arrivalTz;
    if (!timezone) {
      reasons[side] = 'no-airport';
      continue;
    }
    const comparison = findComparisonTime(flight, side);
    if (
      time !== undefined &&
      time !== null &&
      comparison &&
      Math.abs(time * 1000 - comparison.at) > 24 * 60 * 60 * 1000
    ) {
      mismatches.push({ side, reference: comparison.reference });
    }
    if (flight.datePrecision !== 'day') {
      reasons[side] = 'inexact-date';
    } else if (!track.times?.length) {
      reasons[side] = 'no-times';
    } else if (event === null) {
      reasons[side] = airborne(departure ? 0 : lastIndex)
        ? 'in-air'
        : 'not-detected';
    } else {
      // The form stores times to the minute, so round down to match what a
      // previous fill saved and avoid a conflict on every re-detection.
      detected[side] = new TZDate(Math.floor(event / 60) * 60_000, timezone);
    }
  }
  const sideResult = (side: FlightSide): TrackEventTime => {
    const at = detected[side];
    if (mismatches.length) return { at: null, reason: 'mismatch' };
    if (at) return { at, reason: null };
    return { at: null, reason: reasons[side] ?? 'not-detected' };
  };
  return {
    takeoffActual: sideResult('departure'),
    landingActual: sideResult('arrival'),
    mismatches,
  };
};

const storedEventFlight = (flight: StoredEventFlight): TrackEventFlight => {
  const times: TrackEventFlight['times'] = {};
  // A partial date stores its first day in `departure`, which isn't a time.
  if (flight.datePrecision === 'day') {
    for (const field of [
      ...COMPARISON_FIELDS.departure,
      ...COMPARISON_FIELDS.arrival,
    ]) {
      const value = flight[field];
      times[field] = value ? new Date(value) : null;
    }
  }
  return {
    datePrecision: flight.datePrecision,
    departureTz: flight.from?.tz,
    arrivalTz: flight.to?.tz,
    times,
  };
};

const formEventFlight = (form: FlightFormData): TrackEventFlight => {
  const times: TrackEventFlight['times'] = {};
  for (const side of ['departure', 'arrival'] as const) {
    const timezone = side === 'departure' ? form.from?.tz : form.to?.tz;
    for (const field of COMPARISON_FIELDS[side]) {
      const date = form[field];
      const time = form[`${field}Time`];
      if (!date || !time || !timezone) continue;
      try {
        times[field] = mergeTimeWithDate(date, time, timezone);
      } catch {
        times[field] = new Date(NaN);
      }
    }
  }
  return {
    datePrecision: form.datePrecision,
    departureTz: form.from?.tz,
    arrivalTz: form.to?.tz,
    times,
  };
};

/** A flight as stored, or as written through the API: UTC ISO times. */
export type StoredEventFlight = Pick<
  CreateFlight,
  'datePrecision' | ComparisonField | 'from' | 'to'
>;

/** Detect takeoff and landing for a flight as stored or written through the API. */
export const resolveStoredTrackEventTimes = (
  track: EventTrack,
  flight: StoredEventFlight,
) => resolveTrackEventTimes(track, storedEventFlight(flight));

export type DetectedTrackEventTimes = {
  takeoffActual: TZDate | null;
  landingActual: TZDate | null;
};

/** Detect takeoff and landing for the flight form's current values. */
export const prepareTrackEventTimes = (
  track: FlightTrackInput,
  form: FlightFormData,
) => {
  const result = resolveTrackEventTimes(track, formEventFlight(form));
  const detected: DetectedTrackEventTimes = {
    takeoffActual: result.takeoffActual.at,
    landingActual: result.landingActual.at,
  };
  const warnings = result.mismatches.map(
    ({ side, reference }) =>
      `${side === 'departure' ? 'Departure' : 'Arrival'} track time differs from ${reference} by more than 24 hours. Check that this track belongs to this flight.`,
  );
  return { detected, warnings };
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
