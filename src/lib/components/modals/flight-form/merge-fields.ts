import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import {
  formatTimeValue,
  mergeTimeWithDate,
  parseTimeValue,
} from '$lib/utils/datetime';
import type { FlightFormData } from '$lib/zod/flight';

/** Formats a timezone-aware datetime's time part for display. */
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
  | 'takeoffActual'
  | 'landingActual'
  | 'departureTerminal'
  | 'departureGate'
  | 'arrivalTerminal'
  | 'arrivalGate';

export type MergeChoices = Partial<Record<MergeFieldKey, MergeChoice>>;

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

export type MergePlan = {
  states: MergeFieldState[];
  buildPatch: (choices: MergeChoices) => Partial<FlightFormData>;
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

const airportDisplay = (airport: FlightFormData['from']): string =>
  airport ? airport.iata || airport.icao || airport.name : '';

const airlineDisplay = (airline: FlightFormData['airline']): string =>
  airline ? airline.name || airline.icao || '' : '';

const aircraftDisplay = (aircraft: FlightFormData['aircraft']): string =>
  aircraft ? aircraft.name : '';

const dateTimeDisplay = (date: TZDate, formatTime: FormatTime): string =>
  `${format(date, 'yyyy-MM-dd')} ${formatTime(date)}`;

const rawDateTimeDisplay = (
  dateIso: string | null,
  time: string | null,
): string => [dateIso?.slice(0, 10), time].filter(Boolean).join(' ');

const normalizedWallDateTime = (
  dateIso: string | null,
  time: string | null,
): string | null => {
  if (!dateIso || !time) return null;
  const parsedTime = parseTimeValue(time);
  return parsedTime
    ? `${dateIso.slice(0, 10)} ${formatTimeValue(parsedTime)}`
    : null;
};

const toDateTime = (
  dateIso: string | null,
  time: string | null,
  timeZone: string | null | undefined,
): TZDate | null => {
  if (!dateIso || !time || !timeZone) return null;
  try {
    return mergeTimeWithDate(dateIso, time, timeZone);
  } catch {
    return null;
  }
};

type MergePatch = Partial<FlightFormData>;
type TargetAirports = Pick<FlightFormData, 'from' | 'to'>;

type MergeDescriptor = MergeFieldState & {
  fetchedPatch: (targets: TargetAirports) => MergePatch;
  currentPatchForTargets?: (targets: TargetAirports) => MergePatch;
};

const dateTimeFields = {
  departure: { timeField: 'departureTime', airportField: 'from' },
  arrival: { timeField: 'arrivalTime', airportField: 'to' },
  departureScheduled: {
    timeField: 'departureScheduledTime',
    airportField: 'from',
  },
  arrivalScheduled: {
    timeField: 'arrivalScheduledTime',
    airportField: 'to',
  },
  takeoffActual: { timeField: 'takeoffActualTime', airportField: 'from' },
  landingActual: { timeField: 'landingActualTime', airportField: 'to' },
} as const;

type DateTimeFieldKey = keyof typeof dateTimeFields;

const dateTimePatch = (
  key: DateTimeFieldKey,
  source: TZDate,
  targetTimeZone: string | null | undefined,
): MergePatch => {
  const date = targetTimeZone
    ? new TZDate(source.getTime(), targetTimeZone)
    : source;
  const { timeField } = dateTimeFields[key];
  return {
    [key]: format(date, FORM_DATE_FORMAT),
    [timeField]: format(date, 'HH:mm'),
  } as MergePatch;
};

const publicState = (descriptor: MergeDescriptor): MergeFieldState => ({
  key: descriptor.key,
  label: descriptor.label,
  currentDisplay: descriptor.currentDisplay,
  fetchedDisplay: descriptor.fetchedDisplay,
  currentPresent: descriptor.currentPresent,
  fetchedPresent: descriptor.fetchedPresent,
  equal: descriptor.equal,
});

const dateTimeDescriptor = (
  key: DateTimeFieldKey,
  label: string,
  current: FlightFormData,
  fetched: TZDate | null,
  formatTime: FormatTime,
): MergeDescriptor => {
  const { timeField, airportField } = dateTimeFields[key];
  const currentDate = current[key];
  const currentTime = current[timeField];
  const currentTimeZone = current[airportField]?.tz;
  const currentDateTime = toDateTime(currentDate, currentTime, currentTimeZone);
  const currentDisplay = currentDateTime
    ? dateTimeDisplay(currentDateTime, formatTime)
    : rawDateTimeDisplay(currentDate, currentTime);
  const fetchedDisplay = fetched ? dateTimeDisplay(fetched, formatTime) : '';
  const currentWallDateTime = normalizedWallDateTime(currentDate, currentTime);
  const fetchedWallDateTime = fetched
    ? `${format(fetched, 'yyyy-MM-dd')} ${format(fetched, 'HH:mm')}`
    : null;
  const equal = currentDateTime
    ? !!fetched && currentDateTime.getTime() === fetched.getTime()
    : !!currentWallDateTime && currentWallDateTime === fetchedWallDateTime;

  return {
    key,
    label,
    currentDisplay,
    fetchedDisplay,
    currentPresent: !!currentDate,
    fetchedPresent: !!fetched,
    equal,
    fetchedPatch: (targets) =>
      fetched ? dateTimePatch(key, fetched, targets[airportField]?.tz) : {},
    currentPatchForTargets: (targets) => {
      const targetTimeZone = targets[airportField]?.tz;
      if (
        !currentDateTime ||
        !currentTimeZone ||
        !targetTimeZone ||
        currentTimeZone === targetTimeZone
      ) {
        return {};
      }
      return dateTimePatch(key, currentDateTime, targetTimeZone);
    },
  };
};

const planFromDescriptors = (
  descriptors: MergeDescriptor[],
  targetsFor: (fetchedKeys: Set<MergeFieldKey>) => TargetAirports,
): MergePlan => ({
  states: descriptors.map(publicState),
  buildPatch: (choices) => {
    const fetchedKeys = new Set(
      descriptors
        .filter(
          (descriptor) =>
            descriptor.fetchedPresent &&
            (!isConflict(descriptor) || choices[descriptor.key] === 'fetched'),
        )
        .map((descriptor) => descriptor.key),
    );
    const targets = targetsFor(fetchedKeys);
    const patch: MergePatch = {};

    for (const descriptor of descriptors) {
      if (fetchedKeys.has(descriptor.key)) {
        Object.assign(patch, descriptor.fetchedPatch(targets));
      } else if (descriptor.currentPatchForTargets) {
        Object.assign(patch, descriptor.currentPatchForTargets(targets));
      }
    }

    return patch;
  },
});

/**
 * Build conflict state and the matching form patch from one set of descriptors.
 * Datetimes are converted into the final selected airport's timezone, so mixed
 * airport/time choices preserve the underlying instant.
 */
export function buildMergePlan(args: {
  current: FlightFormData;
  result: LookupResultLike;
  aircraft: FlightFormData['aircraft'];
  sources: FetchedSources;
  formatTime: FormatTime;
}): MergePlan {
  const { current, result, aircraft, sources, formatTime } = args;

  const make = (
    state: MergeFieldState,
    fetchedPatch: MergeDescriptor['fetchedPatch'],
    currentPatchForTargets?: MergeDescriptor['currentPatchForTargets'],
  ): MergeDescriptor => ({
    ...state,
    fetchedPatch,
    currentPatchForTargets,
  });

  const entityState = <K extends 'from' | 'to' | 'airline' | 'aircraft'>(
    key: K,
    label: string,
    currentValue: FlightFormData[K],
    fetchedValue: FlightFormData[K],
    display: (value: FlightFormData[K]) => string,
    equal: (
      currentValue: NonNullable<FlightFormData[K]>,
      fetchedValue: NonNullable<FlightFormData[K]>,
    ) => boolean,
  ): MergeDescriptor =>
    make(
      {
        key,
        label,
        currentDisplay: display(currentValue),
        fetchedDisplay: display(fetchedValue),
        currentPresent: !!currentValue,
        fetchedPresent: !!fetchedValue,
        equal:
          !!currentValue && !!fetchedValue && equal(currentValue, fetchedValue),
      },
      () => ({ [key]: fetchedValue }) as MergePatch,
    );

  const stringState = (
    key:
      | 'aircraftReg'
      | 'departureTerminal'
      | 'departureGate'
      | 'arrivalTerminal'
      | 'arrivalGate',
    label: string,
    currentValue: string | null | undefined,
    fetchedValue: string | null | undefined,
  ): MergeDescriptor =>
    make(
      {
        key,
        label,
        currentDisplay: currentValue ?? '',
        fetchedDisplay: fetchedValue ?? '',
        currentPresent: isPresent(currentValue),
        fetchedPresent: isPresent(fetchedValue),
        equal: (currentValue ?? '').trim() === (fetchedValue ?? '').trim(),
      },
      () => ({ [key]: fetchedValue ?? null }) as MergePatch,
    );

  const descriptors: MergeDescriptor[] = [
    entityState(
      'from',
      'Departure airport',
      current.from,
      result.from,
      (value) => airportDisplay(value),
      (currentValue, fetchedValue) => currentValue.id === fetchedValue.id,
    ),
    entityState(
      'to',
      'Arrival airport',
      current.to,
      result.to,
      (value) => airportDisplay(value),
      (currentValue, fetchedValue) => currentValue.id === fetchedValue.id,
    ),
    entityState(
      'airline',
      'Airline',
      current.airline,
      result.airline,
      (value) => airlineDisplay(value),
      (currentValue, fetchedValue) =>
        currentValue.id === fetchedValue.id &&
        currentValue.name === fetchedValue.name,
    ),
    entityState(
      'aircraft',
      'Aircraft',
      current.aircraft,
      aircraft,
      (value) => aircraftDisplay(value),
      (currentValue, fetchedValue) =>
        currentValue.id === fetchedValue.id &&
        currentValue.name === fetchedValue.name,
    ),
    stringState(
      'aircraftReg',
      'Registration',
      current.aircraftReg,
      result.aircraftReg,
    ),
    dateTimeDescriptor(
      'departure',
      'Departure time',
      current,
      sources.departure,
      formatTime,
    ),
    dateTimeDescriptor(
      'arrival',
      'Arrival time',
      current,
      sources.arrival,
      formatTime,
    ),
    dateTimeDescriptor(
      'departureScheduled',
      'Scheduled departure',
      current,
      sources.departureScheduled,
      formatTime,
    ),
    dateTimeDescriptor(
      'arrivalScheduled',
      'Scheduled arrival',
      current,
      sources.arrivalScheduled,
      formatTime,
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

  return planFromDescriptors(descriptors, (fetchedKeys) => ({
    from: fetchedKeys.has('from') ? result.from : current.from,
    to: fetchedKeys.has('to') ? result.to : current.to,
  }));
}

/*
 * Merge plan for takeoff and landing times detected from a track. A time typed
 * without its date still counts as a value, so it goes to the conflict picker
 * rather than being replaced.
 */
export function buildTrackTimesMergePlan(args: {
  current: FlightFormData;
  detected: { takeoffActual: TZDate | null; landingActual: TZDate | null };
  formatTime: FormatTime;
}): MergePlan {
  const { current, detected, formatTime } = args;
  const descriptors = (
    [
      ['takeoffActual', 'Takeoff'],
      ['landingActual', 'Landing'],
    ] as const
  ).map(([key, label]) => {
    const descriptor = dateTimeDescriptor(
      key,
      label,
      current,
      detected[key],
      formatTime,
    );
    return {
      ...descriptor,
      currentPresent:
        descriptor.currentPresent ||
        isPresent(current[dateTimeFields[key].timeField]),
    };
  });
  return planFromDescriptors(descriptors, () => current);
}

/** Build just the display/conflict state when no patch is needed. */
export function buildMergeFieldStates(
  args: Parameters<typeof buildMergePlan>[0],
): MergeFieldState[] {
  return buildMergePlan(args).states;
}

/** A field is a conflict when both sides have a differing value. */
export function isConflict(state: MergeFieldState): boolean {
  return state.currentPresent && state.fetchedPresent && !state.equal;
}
