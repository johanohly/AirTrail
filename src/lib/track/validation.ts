import type { TrackMetadata } from './metadata';
import type { FlightTrackInput } from './schema';

import { mergeTimeWithDate } from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

export type TrackValidationIssue = {
  field: 'departure' | 'arrival' | 'flightNumber';
  message: string;
} & (
  | { kind: 'metadata'; trackValue: string; enteredValue: string }
  | { kind: 'timing'; comparison: 'scheduled' | 'actual' }
);

const normalize = (value: string) => value.toUpperCase().replace(/\s/g, '');

type TrackMetadataValidationContext = Pick<
  FlightFormData,
  'flightNumber' | 'airline'
> & {
  from: FlightFormData['from'] | null;
  to: FlightFormData['to'] | null;
};

export const validateTrackMetadata = (
  metadata: TrackMetadata | null,
  form: TrackMetadataValidationContext,
): TrackValidationIssue[] => {
  if (!metadata) return [];
  const issues: TrackValidationIssue[] = [];
  for (const departure of [true, false]) {
    const codes = departure ? metadata.originCodes : metadata.destinationCodes;
    const airport = departure ? form.from : form.to;
    if (
      airport &&
      codes.length &&
      !codes.some((code) =>
        [airport.iata, airport.icao].some(
          (value) => value && normalize(value) === normalize(code),
        ),
      )
    ) {
      issues.push({
        kind: 'metadata',
        trackValue: codes.join(' / '),
        enteredValue: airport.iata || airport.icao,
        field: departure ? 'departure' : 'arrival',
        message: `${departure ? 'Departure' : 'Arrival'} airport in the track (${codes.join(' / ')}) differs from the selected airport (${airport.iata || airport.icao}).`,
      });
    }
  }
  if (form.flightNumber && metadata.flightIdentifiers.length) {
    const number = normalize(form.flightNumber);
    const identifiers = new Set([number]);
    const prefixes = [
      form.airline?.iata?.replace(/\*$/, ''),
      form.airline?.icao,
    ]
      .filter((value): value is string => !!value)
      .sort((a, b) => b.length - a.length);
    // Also support forms containing just the number, or either airline prefix.
    const prefix = prefixes.find((value) => number.startsWith(value));
    const suffix = /^\d+[A-Z]?$/.test(number)
      ? number
      : prefix
        ? number.slice(prefix.length)
        : null;
    if (suffix) for (const prefix of prefixes) identifiers.add(prefix + suffix);
    if (
      !metadata.flightIdentifiers.some((id) => identifiers.has(normalize(id)))
    ) {
      issues.push({
        kind: 'metadata',
        trackValue: metadata.flightIdentifiers.join(' / '),
        enteredValue: form.flightNumber,
        field: 'flightNumber',
        message: `Flight number/callsign in the track (${metadata.flightIdentifiers.join(' / ')}) differs from the selected flight (${form.flightNumber}).`,
      });
    }
  }
  return issues;
};

export const validateTrackTiming = (
  track: FlightTrackInput,
  form: FlightFormData,
  events: { takeoff: number | null; landing: number | null },
): TrackValidationIssue[] => {
  const issues: TrackValidationIssue[] = [];
  for (const departure of [true, false]) {
    const time =
      (departure ? events.takeoff : events.landing) ??
      (departure ? track.times?.[0] : track.times?.at(-1));
    const scheduledDate = departure
      ? form.departureScheduled
      : form.arrivalScheduled;
    const scheduledTime = departure
      ? form.departureScheduledTime
      : form.arrivalScheduledTime;
    const useSchedule = Boolean(scheduledDate && scheduledTime);
    const date = useSchedule
      ? scheduledDate
      : departure
        ? form.departure
        : form.arrival;
    const comparisonTime = useSchedule
      ? scheduledTime
      : departure
        ? form.departureTime
        : form.arrivalTime;
    const airport = departure ? form.from : form.to;
    if (time == null || !date || !comparisonTime || !airport?.tz) continue;
    try {
      const reference = mergeTimeWithDate(date, comparisonTime, airport.tz);
      if (Math.abs(time * 1000 - reference.getTime()) > 24 * 60 * 60 * 1000) {
        issues.push({
          kind: 'timing',
          comparison: useSchedule ? 'scheduled' : 'actual',
          field: departure ? 'departure' : 'arrival',
          message: `${departure ? 'Departure' : 'Arrival'} track time differs from ${useSchedule ? 'the original schedule' : 'the entered actual time'} by more than 24 hours. Check that this track belongs to this flight.`,
        });
      }
    } catch {
      // Invalid date/time fields are validated by the flight form.
    }
  }
  return issues;
};
