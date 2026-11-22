import { CalendarDate } from '@internationalized/date';
import { isAfter, isBefore } from 'date-fns';

import {
  buildFilterOptions,
  flightValues,
  OPTION_FILTERS,
  optionFilterDefinition,
  type FilterId,
  type FilterOption,
  type FilterScope,
  type OptionFilterId,
} from './definitions';
import {
  hasTempFilters,
  routeMatchesEndpoints,
  type FlightFilters,
  type MultiOptionFilterOperator,
  type OptionFilterOperator,
  type OptionFilterState,
  type TempFilters,
} from './types';

import type { FilterModel, FiltersState } from '$lib/primitives';
import type { FlightData } from '$lib/utils';
import { parseLocalISO } from '$lib/utils/datetime';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';

export type OperatorChoice<TOperator extends string> = {
  value: TOperator;
  label: string;
};

const optionOperators: ReadonlyArray<OperatorChoice<OptionFilterOperator>> = [
  { value: 'is', label: 'Is' },
  { value: 'is not', label: 'Is not' },
  { value: 'is any of', label: 'Is any of' },
  { value: 'is none of', label: 'Is none of' },
];

const multiOptionOperators: ReadonlyArray<
  OperatorChoice<MultiOptionFilterOperator>
> = [
  { value: 'include', label: 'Include' },
  { value: 'exclude', label: 'Exclude' },
  { value: 'include any of', label: 'Include any of' },
  { value: 'include all of', label: 'Include all of' },
  { value: 'include exactly', label: 'Include exactly' },
  { value: 'exclude if any of', label: 'Exclude if any of' },
  { value: 'exclude if all', label: 'Exclude if all' },
  { value: 'exclude exactly', label: 'Exclude exactly' },
];

const SINGULAR_OPERATORS = new Set<string>([
  'is',
  'is not',
  'include',
  'exclude',
  'include exactly',
  'exclude exactly',
]);

const PLURAL_OPERATORS = new Set<string>([
  'is any of',
  'is none of',
  'include any of',
  'include all of',
  'include exactly',
  'exclude if any of',
  'exclude if all',
  'exclude exactly',
]);

/* The operators that fit a filter with this many values selected. */
export const operatorChoices = (
  id: OptionFilterId,
  valueCount: number,
): ReadonlyArray<
  OperatorChoice<OptionFilterOperator | MultiOptionFilterOperator>
> => {
  const choices = optionFilterDefinition(id).multi
    ? multiOptionOperators
    : optionOperators;
  const fitting = valueCount > 1 ? PLURAL_OPERATORS : SINGULAR_OPERATORS;
  return choices.filter((choice) => fitting.has(choice.value));
};

const defaultOperator = (id: OptionFilterId) =>
  optionFilterDefinition(id).multi ? 'include any of' : 'is any of';

/* Keeps an operator's meaning when the number of selected values changes. */
export function normalizeOperator(
  operator: OptionFilterOperator | MultiOptionFilterOperator,
  valueCount: number,
): OptionFilterOperator | MultiOptionFilterOperator {
  if (valueCount > 1) {
    if (operator === 'is') return 'is any of';
    if (operator === 'is not') return 'is none of';
    if (operator === 'include') return 'include any of';
    if (operator === 'exclude') return 'exclude if any of';
    return operator;
  }
  if (operator === 'is any of') return 'is';
  if (operator === 'is none of') return 'is not';
  if (operator === 'include any of' || operator === 'include all of') {
    return 'include';
  }
  if (operator === 'exclude if any of' || operator === 'exclude if all') {
    return 'exclude';
  }
  return operator;
}

export const createDefaultFilters = (): FlightFilters => ({
  options: {},
  fromDate: undefined,
  toDate: undefined,
  airportsEither: [],
  routes: [],
});

export function cloneFlightFilters(
  source: FlightFilters,
  next: Partial<FlightFilters> = {},
): FlightFilters {
  const merged = { ...source, ...next };
  return {
    ...merged,
    airportsEither: [...merged.airportsEither],
    routes: merged.routes.map((route) => ({ ...route })),
    options: Object.fromEntries(
      Object.entries(merged.options).map(([id, state]) => [
        id,
        { ...state, values: [...state.values] },
      ]),
    ),
  };
}

const hasDateFilter = (filters: FlightFilters) =>
  !!(filters.fromDate || filters.toDate);

export const hasFlightFilters = (filters: FlightFilters | undefined) =>
  !!filters &&
  (hasDateFilter(filters) ||
    Object.keys(filters.options).length > 0 ||
    filters.airportsEither.length > 0 ||
    filters.routes.length > 0);

export const isFilterActive = (filters: FlightFilters, id: FilterId) =>
  id === 'date' ? hasDateFilter(filters) : !!filters.options[id];

export const optionFilterState = (
  filters: FlightFilters,
  id: OptionFilterId,
): OptionFilterState => {
  const state = filters.options[id];
  if (!state) {
    return { values: [], operator: normalizeOperator(defaultOperator(id), 0) };
  }
  return {
    values: state.values,
    operator: normalizeOperator(state.operator, state.values.length),
  };
};

export function setOptionFilter(
  filters: FlightFilters,
  id: OptionFilterId,
  next: Partial<OptionFilterState>,
): FlightFilters {
  const current = optionFilterState(filters, id);
  const values = next.values ?? current.values;
  const options = { ...filters.options };
  if (values.length) {
    options[id] = {
      values,
      operator: normalizeOperator(
        next.operator ?? current.operator,
        values.length,
      ),
    };
  } else {
    delete options[id];
  }
  return cloneFlightFilters(filters, { options });
}

export function clearFilter(
  filters: FlightFilters,
  id: FilterId,
): FlightFilters {
  if (id === 'date') {
    return cloneFlightFilters(filters, {
      fromDate: undefined,
      toDate: undefined,
    });
  }
  return setOptionFilter(filters, id, { values: [] });
}

/*
 * The years a filter selects, or an empty list when it selects something
 * else: no year, "every year but", or a range that isn't one whole year.
 */
export function selectedFilterYears(filters: FlightFilters): string[] {
  const year = filters.options.year;
  if (year) {
    return year.operator === 'is' || year.operator === 'is any of'
      ? year.values
      : [];
  }
  return filters.fromDate && isFullYearRange(filters.fromDate, filters.toDate)
    ? [filters.fromDate.year.toString()]
    : [];
}

/*
 * The filters to count flights per year with. A year filter is ignored, so the
 * other years stay visible and can be picked. Any other date filter stays, as
 * those are not a choice between years.
 */
export function perYearFilters(filters: FlightFilters): FlightFilters {
  if (!selectedFilterYears(filters).length) return filters;
  return clearFilter(clearFilter(filters, 'year'), 'date');
}

/* Filters to one year, or back to all years if that is the only one selected. */
export function toggleFilterYear(
  filters: FlightFilters,
  year: string,
): FlightFilters {
  const withoutDates = clearFilter(filters, 'date');
  const selected = selectedFilterYears(filters);
  if (selected.length === 1 && selected[0] === year) {
    return clearFilter(withoutDates, 'year');
  }
  return setOptionFilter(withoutDates, 'year', {
    values: [year],
    operator: 'is',
  });
}

export type DatePresetId =
  | 'past-30-days'
  | 'past-90-days'
  | 'past-12-months'
  | 'this-year'
  | 'last-year';

export const datePresets: ReadonlyArray<{ id: DatePresetId; label: string }> = [
  { id: 'past-30-days', label: 'Past 30 days' },
  { id: 'past-90-days', label: 'Past 90 days' },
  { id: 'past-12-months', label: 'Past 12 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-year', label: 'Last year' },
];

export function todayCalendarDate(): CalendarDate {
  const now = new Date();
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/*
 * The date range a preset stands for, resolved against `today`. Rolling
 * windows are fixed when applied; they don't move on later days.
 */
export function datePresetRange(
  id: DatePresetId,
  today: CalendarDate,
): { fromDate: CalendarDate; toDate: CalendarDate } {
  switch (id) {
    case 'past-30-days':
      return { fromDate: today.subtract({ days: 29 }), toDate: today };
    case 'past-90-days':
      return { fromDate: today.subtract({ days: 89 }), toDate: today };
    case 'past-12-months':
      return {
        fromDate: today.subtract({ years: 1 }).add({ days: 1 }),
        toDate: today,
      };
    case 'this-year':
      return {
        fromDate: new CalendarDate(today.year, 1, 1),
        toDate: new CalendarDate(today.year, 12, 31),
      };
    case 'last-year':
      return {
        fromDate: new CalendarDate(today.year - 1, 1, 1),
        toDate: new CalendarDate(today.year - 1, 12, 31),
      };
  }
}

/* The preset whose exact range is applied, if any. */
export function activeDatePreset(
  filters: FlightFilters,
  today: CalendarDate,
): DatePresetId | undefined {
  return datePresets.find(({ id }) => {
    const range = datePresetRange(id, today);
    return (
      filters.fromDate?.compare(range.fromDate) === 0 &&
      filters.toDate?.compare(range.toDate) === 0
    );
  })?.id;
}

/* Applies a preset, or clears the date if that preset is already applied. */
export function toggleDatePreset(
  filters: FlightFilters,
  id: DatePresetId,
  today: CalendarDate,
): FlightFilters {
  if (activeDatePreset(filters, today) === id) {
    return clearFilter(filters, 'date');
  }
  return cloneFlightFilters(filters, datePresetRange(id, today));
}

export function formatDateLabel(
  value: CalendarDate | undefined,
  prefs: Pick<Preferences, 'dateFormat'>,
) {
  if (!value) return '';
  return formatDate(new Date(value.year, value.month - 1, value.day), prefs);
}

export function dateFilterSummary(
  filters: FlightFilters,
  prefs: Pick<Preferences, 'dateFormat'>,
) {
  const { fromDate, toDate } = filters;
  if (fromDate && toDate) {
    if (fromDate.compare(toDate) === 0) return formatDateLabel(fromDate, prefs);
    return `${formatDateLabel(fromDate, prefs)} - ${formatDateLabel(toDate, prefs)}`;
  }
  if (fromDate) return `From ${formatDateLabel(fromDate, prefs)}`;
  if (toDate) return `Until ${formatDateLabel(toDate, prefs)}`;
  return 'Choose date';
}

function isFullYearRange(fromDate?: CalendarDate, toDate?: CalendarDate) {
  if (!fromDate || !toDate || fromDate.year !== toDate.year) return false;
  return (
    fromDate.month === 1 &&
    fromDate.day === 1 &&
    toDate.month === 12 &&
    toDate.day === 31
  );
}

const calendarDateToDate = (value: CalendarDate) =>
  new Date(value.year, value.month - 1, value.day);

const dateToCalendarDate = (value: unknown) =>
  value instanceof Date
    ? new CalendarDate(
        value.getFullYear(),
        value.getMonth() + 1,
        value.getDate(),
      )
    : undefined;

function dateFilterToBits(source: FlightFilters): FilterModel | undefined {
  const { fromDate, toDate } = source;
  const filter = (operator: string, dates: CalendarDate[]): FilterModel => ({
    columnId: 'date',
    type: 'date',
    operator: operator as FilterModel<'date'>['operator'],
    values: dates.map(calendarDateToDate),
  });

  if (fromDate && toDate) {
    const [start, end] =
      fromDate.compare(toDate) <= 0 ? [fromDate, toDate] : [toDate, fromDate];
    return start.compare(end) === 0
      ? filter('is', [start])
      : filter('is between', [start, end]);
  }
  if (fromDate) return filter('is on or after', [fromDate]);
  if (toDate) return filter('is on or before', [toDate]);
}

export function flightFiltersToBits(source: FlightFilters): FiltersState {
  const result: FiltersState = [];
  for (const definition of OPTION_FILTERS) {
    const state = source.options[definition.id];
    if (!state) continue;
    result.push({
      columnId: definition.id,
      type: definition.multi ? 'multiOption' : 'option',
      operator: state.operator,
      values: state.values,
    } as FilterModel);
  }
  const date = dateFilterToBits(source);
  if (date) result.push(date);
  return result;
}

function applyBitsDateFilter(target: FlightFilters, filter: FilterModel) {
  const first = dateToCalendarDate(filter.values[0]);
  const second = dateToCalendarDate(filter.values[1]);
  if (!first) return;

  switch (filter.operator) {
    case 'is':
      target.fromDate = first;
      target.toDate = first;
      break;
    case 'is before':
      target.toDate = first.subtract({ days: 1 });
      break;
    case 'is on or before':
      target.toDate = first;
      break;
    case 'is after':
      target.fromDate = first.add({ days: 1 });
      break;
    case 'is on or after':
      target.fromDate = first;
      break;
    case 'is between':
      if (second) {
        [target.fromDate, target.toDate] =
          first.compare(second) <= 0 ? [first, second] : [second, first];
      }
      break;
  }
}

/* The filters the bits state describes, keeping `base`'s map pins. */
export function bitsFiltersToFlightFilters(
  source: FiltersState,
  base: FlightFilters,
): FlightFilters {
  let result = cloneFlightFilters(createDefaultFilters(), {
    airportsEither: base.airportsEither,
    routes: base.routes,
  });
  const optionIds = new Set<string>(OPTION_FILTERS.map(({ id }) => id));

  for (const filter of source) {
    if (filter.columnId === 'date') {
      applyBitsDateFilter(result, filter);
    } else if (optionIds.has(filter.columnId)) {
      result = setOptionFilter(result, filter.columnId as OptionFilterId, {
        values: filter.values.filter(
          (value): value is string => typeof value === 'string',
        ),
        operator: filter.operator as OptionFilterState['operator'],
      });
    }
  }
  return result;
}

export function bitsSignature(source: FiltersState) {
  return JSON.stringify(
    source.map((filter) => ({
      columnId: filter.columnId,
      operator: filter.operator,
      values: filter.values.map((value) =>
        value instanceof Date ? dateToCalendarDate(value)?.toString() : value,
      ),
    })),
  );
}

export const flightSignature = (source: FlightFilters) =>
  JSON.stringify({
    options: OPTION_FILTERS.map(({ id }) => source.options[id] ?? null),
    fromDate: source.fromDate?.toString(),
    toDate: source.toDate?.toString(),
    airportsEither: source.airportsEither,
    routes: source.routes,
  });

const INCLUSIVE_PASSENGER_OPERATORS = new Set<string>([
  'include',
  'include any of',
  'include all of',
  'include exactly',
]);

/*
 * Seat filters read the rows of the passengers an inclusive passenger filter
 * picks. Otherwise they read the shown user's row, or every row when all
 * users' flights are shown. An excluding passenger filter doesn't count: the
 * flight matched because those people aren't on it.
 */
export function filterScope(
  filters: FlightFilters,
  seatUserId?: string,
): FilterScope {
  const passengers = filters.options.passengers;
  if (passengers && INCLUSIVE_PASSENGER_OPERATORS.has(passengers.operator)) {
    return { passengerTokens: passengers.values };
  }
  return { seatUserId };
}

export function optionMatches(
  values: string[],
  selectedValues: string[],
  operator: OptionFilterOperator | MultiOptionFilterOperator,
) {
  const present = new Set(values);
  const hasAny = selectedValues.some((value) => present.has(value));
  const hasAll = selectedValues.every((value) => present.has(value));
  const exactly =
    hasAll && [...present].every((value) => selectedValues.includes(value));

  switch (operator) {
    case 'is':
    case 'is any of':
    case 'include':
    case 'include any of':
      return hasAny;
    case 'is not':
    case 'is none of':
    case 'exclude':
    case 'exclude if any of':
      return !hasAny;
    case 'include all of':
      return hasAll;
    case 'exclude if all':
      return !hasAll;
    case 'include exactly':
      return exactly;
    case 'exclude exactly':
      return !exactly;
  }
}

export function matchesTempFilters(
  flight: FlightData,
  {
    departureAirports = [],
    arrivalAirports = [],
    airportsEither = [],
    routes = [],
  }: Partial<TempFilters>,
) {
  const fromId = flight.from?.id.toString() ?? '';
  const toId = flight.to?.id.toString() ?? '';
  return (
    (!departureAirports.length || departureAirports.includes(fromId)) &&
    (!arrivalAirports.length || arrivalAirports.includes(toId)) &&
    (!airportsEither.length ||
      (!!fromId &&
        !!toId &&
        (airportsEither.includes(fromId) || airportsEither.includes(toId)))) &&
    (!routes.length ||
      routes.some((route) => routeMatchesEndpoints(fromId, toId, route)))
  );
}

const dateBoundary = (date: CalendarDate, tzId: string, end = false) =>
  parseLocalISO(`${date.toString()}T${end ? '23:59:59.999' : '00:00'}`, tzId);

function matchesDateRange(flight: FlightData, filters: FlightFilters) {
  const { fromDate, toDate } = filters;
  if (
    fromDate &&
    (!flight.dateEnd ||
      isBefore(
        flight.dateEnd,
        dateBoundary(fromDate, flight.dateEnd.timeZone ?? 'UTC'),
      ))
  ) {
    return false;
  }
  return !(
    toDate &&
    (!flight.dateStart ||
      isAfter(
        flight.dateStart,
        dateBoundary(toDate, flight.dateStart.timeZone ?? 'UTC', true),
      ))
  );
}

export type FlightMatcherContext = {
  seatUserId?: string;
  /** An active map drilldown, which replaces the airport filters. */
  tempFilters?: TempFilters;
};

/* A test for whether a flight passes every active filter. */
export function flightMatcher(
  filters: FlightFilters,
  { seatUserId, tempFilters }: FlightMatcherContext = {},
) {
  const drilldown =
    tempFilters && hasTempFilters(tempFilters) ? tempFilters : undefined;
  const scope = filterScope(filters, seatUserId);
  const active = OPTION_FILTERS.flatMap((definition) => {
    const state = filters.options[definition.id];
    if (!state || (drilldown && definition.replacedByDrilldown)) return [];
    return [{ definition, state }];
  });

  // A drilldown replaces the map pins and the airport filters, as it picks
  // the airports itself.
  const location = drilldown ?? {
    airportsEither: filters.airportsEither,
    routes: filters.routes,
  };

  return (flight: FlightData) =>
    matchesTempFilters(flight, location) &&
    matchesDateRange(flight, filters) &&
    active.every(({ definition, state }) =>
      optionMatches(
        flightValues(definition, flight, scope),
        state.values,
        state.operator,
      ),
    );
}

/*
 * Every option filter's options for these flights, with counts. A map
 * drilldown narrows the flights the options come from. Desktop and mobile both
 * read this, so they offer the same options and counts.
 */
export function filterOptions(
  flights: FlightData[],
  { scope, tempFilters }: { scope: FilterScope; tempFilters?: TempFilters },
): Record<OptionFilterId, FilterOption[]> {
  const source =
    tempFilters && hasTempFilters(tempFilters)
      ? flights.filter((flight) => matchesTempFilters(flight, tempFilters))
      : flights;
  return Object.fromEntries(
    OPTION_FILTERS.map((definition) => [
      definition.id,
      buildFilterOptions(definition, source, scope),
    ]),
  ) as Record<OptionFilterId, FilterOption[]>;
}
