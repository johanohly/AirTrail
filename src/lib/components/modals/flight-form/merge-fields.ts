import type { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import type { FlightFormData } from '$lib/zod/flight';

/** Formats a timezone-aware datetime's time part (matches the form's stored times). */
export type FormatTime = (date: TZDate) => string;

export type MergeChoice = 'current' | 'fetched';

export type MergeFieldKey =
  | 'from'
  | 'to'
  | 'airline'
  | 'aircraft'
  | 'aircraftReg'
  | 'departure'
  | 'arrival'
  | 'departureScheduled'
  | 'arrivalScheduled'
  | 'departureTerminal'
  | 'departureGate'
  | 'arrivalTerminal'
  | 'arrivalGate';

/** The value shown for one side of a conflict in the picker. */
export type MergeField = {
  key: MergeFieldKey;
  label: string;
  currentDisplay: string;
  fetchedDisplay: string;
};

/** Full state for a field, used to decide conflicts vs. auto-apply. */
export type MergeFieldState = MergeField & {
  currentPresent: boolean;
  fetchedPresent: boolean;
  equal: boolean;
};

/**
 * Minimal shape of a parsed lookup result that the merge logic needs. Kept
 * structural so this module stays decoupled from the Svelte component.
 */
export type LookupResultLike = {
  from: FlightFormData['from'];
  to: FlightFormData['to'];
  airline: FlightFormData['airline'];
  aircraftReg?: FlightFormData['aircraftReg'];
  departure: TZDate | null;
  arrival: TZDate | null;
  departureScheduled: TZDate | null;
  arrivalScheduled: TZDate | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
};

/** The timezone-aware datetimes the lookup actually contributes to the form. */
export type FetchedSources = {
  departure: TZDate | null;
  arrival: TZDate | null;
  departureScheduled: TZDate | null;
  arrivalScheduled: TZDate | null;
};

export const FORM_DATE_FORMAT = "yyyy-MM-dd'T'00:00:00.000'Z'";

/**
 * Resolve which datetimes the lookup provides, mirroring the guards used when
 * applying: actual times are only used for non-future flights that have both a
 * departure and an arrival; scheduled times fall back to the lookup time for
 * future flights.
 */
export function getFetchedSources(
  result: LookupResultLike,
  isFuture: boolean,
): FetchedSources {
  const actualAvailable = !!(result.departure && result.arrival && !isFuture);

  return {
    departure: actualAvailable ? result.departure : null,
    arrival: actualAvailable ? result.arrival : null,
    departureScheduled:
      result.departureScheduled ?? (isFuture ? result.departure : null),
    arrivalScheduled:
      result.arrivalScheduled ?? (isFuture ? result.arrival : null),
  };
}

const isPresent = (value: string | null | undefined): boolean =>
  value !== null && value !== undefined && value.trim() !== '';

const airportDisplay = (a: FlightFormData['from']): string =>
  a ? a.iata || a.icao || a.name : '';

const airlineDisplay = (a: FlightFormData['airline']): string =>
  a ? a.name || a.icao || '' : '';

const aircraftDisplay = (a: FlightFormData['aircraft']): string =>
  a ? a.name : '';

const fetchedDateTimeDisplay = (
  date: TZDate | null,
  formatTime: FormatTime,
): string => (date ? `${format(date, 'yyyy-MM-dd')} ${formatTime(date)}` : '');

const currentDateTimeDisplay = (
  dateIso: string | null,
  time: string | null,
): string => (dateIso ? `${dateIso.slice(0, 10)} ${time ?? ''}`.trim() : '');

/**
 * Build the state for every field the lookup can touch: whether each side has a
 * value, whether they are equal, and their display strings. Callers filter this
 * into conflicts (see {@link isConflict}) and auto-applied fields.
 */
export function buildMergeFieldStates(args: {
  current: FlightFormData;
  result: LookupResultLike;
  aircraft: FlightFormData['aircraft'];
  sources: FetchedSources;
  formatTime: FormatTime;
}): MergeFieldState[] {
  const { current, result, aircraft, sources, formatTime } = args;

  const make = (
    key: MergeFieldKey,
    label: string,
    currentDisplay: string,
    fetchedDisplay: string,
    currentPresent: boolean,
    fetchedPresent: boolean,
    equal: boolean,
  ): MergeFieldState => ({
    key,
    label,
    currentDisplay,
    fetchedDisplay,
    currentPresent,
    fetchedPresent,
    equal,
  });

  const dateTimeState = (
    key: MergeFieldKey,
    label: string,
    currentDate: string | null,
    currentTime: string | null,
    fetched: TZDate | null,
  ): MergeFieldState => {
    const currentDisplay = currentDateTimeDisplay(currentDate, currentTime);
    const fetchedDisplay = fetchedDateTimeDisplay(fetched, formatTime);
    return make(
      key,
      label,
      currentDisplay,
      fetchedDisplay,
      !!currentDate,
      !!fetched,
      currentDisplay === fetchedDisplay,
    );
  };

  const stringState = (
    key: MergeFieldKey,
    label: string,
    currentValue: string | null | undefined,
    fetchedValue: string | null | undefined,
  ): MergeFieldState =>
    make(
      key,
      label,
      currentValue ?? '',
      fetchedValue ?? '',
      isPresent(currentValue),
      isPresent(fetchedValue),
      (currentValue ?? '').trim() === (fetchedValue ?? '').trim(),
    );

  return [
    make(
      'from',
      'Departure airport',
      airportDisplay(current.from),
      airportDisplay(result.from),
      !!current.from,
      !!result.from,
      current.from?.id === result.from?.id,
    ),
    make(
      'to',
      'Arrival airport',
      airportDisplay(current.to),
      airportDisplay(result.to),
      !!current.to,
      !!result.to,
      current.to?.id === result.to?.id,
    ),
    make(
      'airline',
      'Airline',
      airlineDisplay(current.airline),
      airlineDisplay(result.airline),
      !!current.airline,
      !!result.airline,
      !!current.airline &&
        !!result.airline &&
        current.airline.id === result.airline.id &&
        current.airline.name === result.airline.name,
    ),
    make(
      'aircraft',
      'Aircraft',
      aircraftDisplay(current.aircraft),
      aircraftDisplay(aircraft),
      !!current.aircraft,
      !!aircraft,
      !!current.aircraft &&
        !!aircraft &&
        current.aircraft.id === aircraft.id &&
        current.aircraft.name === aircraft.name,
    ),
    stringState(
      'aircraftReg',
      'Registration',
      current.aircraftReg,
      result.aircraftReg,
    ),
    dateTimeState(
      'departure',
      'Departure time',
      current.departure,
      current.departureTime,
      sources.departure,
    ),
    dateTimeState(
      'arrival',
      'Arrival time',
      current.arrival,
      current.arrivalTime,
      sources.arrival,
    ),
    dateTimeState(
      'departureScheduled',
      'Scheduled departure',
      current.departureScheduled,
      current.departureScheduledTime,
      sources.departureScheduled,
    ),
    dateTimeState(
      'arrivalScheduled',
      'Scheduled arrival',
      current.arrivalScheduled,
      current.arrivalScheduledTime,
      sources.arrivalScheduled,
    ),
    stringState(
      'departureTerminal',
      'Departure terminal',
      current.departureTerminal,
      result.departureTerminal,
    ),
    stringState(
      'departureGate',
      'Departure gate',
      current.departureGate,
      result.departureGate,
    ),
    stringState(
      'arrivalTerminal',
      'Arrival terminal',
      current.arrivalTerminal,
      result.arrivalTerminal,
    ),
    stringState(
      'arrivalGate',
      'Arrival gate',
      current.arrivalGate,
      result.arrivalGate,
    ),
  ];
}

/** A field is a conflict when both sides have a differing value. */
export function isConflict(state: MergeFieldState): boolean {
  return state.currentPresent && state.fetchedPresent && !state.equal;
}
