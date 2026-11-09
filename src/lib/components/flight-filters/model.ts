import { CalendarDate } from '@internationalized/date';
import { isAfter, isBefore } from 'date-fns';
import type { FilterModel, FiltersState } from 'bits-ui';

import {
  routeMatchesEndpoints,
  type FlightFilters,
  type LocationFilters,
  type MultiOptionFilterOperator,
  type OptionFilterOperator,
  type Route,
} from './types';

import { getFlightPassengerToken, type FlightData } from '$lib/utils';
import { parseLocalISO } from '$lib/utils/datetime';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';
import { page } from '$app/state';
import { FlightReasons } from '$lib/db/types';

export type FilterColumnId =
  | 'departureAirports'
  | 'arrivalAirports'
  | 'years'
  | 'date'
  | 'passengers'
  | 'reasons'
  | 'airline'
  | 'aircraft'
  | 'aircraftRegs';

export type OptionColumnId = Exclude<FilterColumnId, 'date'>;
export type NonPassengerOptionColumnId = Exclude<OptionColumnId, 'passengers'>;

export type OperatorChoice<TOperator extends string> = {
  value: TOperator;
  label: string;
};

export const optionOperators: ReadonlyArray<
  OperatorChoice<OptionFilterOperator>
> = [
  { value: 'is', label: 'Is' },
  { value: 'is not', label: 'Is not' },
  { value: 'is any of', label: 'Is any of' },
  { value: 'is none of', label: 'Is none of' },
];

export const singularOptionOperators = optionOperators.filter(
  (operator) => operator.value === 'is' || operator.value === 'is not',
);

export const pluralOptionOperators = optionOperators.filter(
  (operator) =>
    operator.value === 'is any of' || operator.value === 'is none of',
);

export const multiOptionOperators: ReadonlyArray<
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

export const singularMultiOptionOperators = multiOptionOperators.filter(
  (operator) =>
    operator.value === 'include' ||
    operator.value === 'exclude' ||
    operator.value === 'include exactly' ||
    operator.value === 'exclude exactly',
);

export const pluralMultiOptionOperators = multiOptionOperators.filter(
  (operator) => operator.value !== 'include' && operator.value !== 'exclude',
);

export function createDefaultFilters(): FlightFilters {
  return {
    departureAirports: [],
    departureAirportsOperator: 'is any of',
    arrivalAirports: [],
    arrivalAirportsOperator: 'is any of',
    airportsEither: [],
    routes: [],
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    reasons: [],
    reasonsOperator: 'is any of',
    airline: [],
    airlineOperator: 'is any of',
    aircraft: [],
    aircraftOperator: 'is any of',
    aircraftRegs: [],
    aircraftRegsOperator: 'is any of',
  };
}

export function cloneFlightFilters(
  source: FlightFilters,
  next: Partial<FlightFilters> = {},
): FlightFilters {
  return {
    ...source,
    departureAirports: [...source.departureAirports],
    arrivalAirports: [...source.arrivalAirports],
    airportsEither: [...source.airportsEither],
    routes: source.routes.map((route) => ({ ...route })),
    years: [...source.years],
    passengers: [...source.passengers],
    reasons: [...source.reasons],
    airline: [...source.airline],
    aircraft: [...source.aircraft],
    aircraftRegs: [...source.aircraftRegs],
    ...(source.excludedValues
      ? {
          excludedValues: Object.fromEntries(
            Object.entries(source.excludedValues).map(([key, values]) => [
              key,
              [...values],
            ]),
          ),
        }
      : {}),
    ...next,
  };
}

export function hasFlightFilters(filters: FlightFilters | undefined): boolean {
  return !!(
    filters &&
    (Object.values(filters.excludedValues ?? {}).some(
      (values) => values.length > 0,
    ) ||
      filters.departureAirports.length > 0 ||
      filters.arrivalAirports.length > 0 ||
      filters.airportsEither.length > 0 ||
      filters.routes.length > 0 ||
      filters.years.length > 0 ||
      filters.fromDate ||
      filters.toDate ||
      filters.passengers.length > 0 ||
      filters.reasons.length > 0 ||
      filters.airline.length > 0 ||
      filters.aircraft.length > 0 ||
      filters.aircraftRegs.length > 0)
  );
}

export function normalizeOptionOperator(
  operator: OptionFilterOperator,
  valueCount: number,
): OptionFilterOperator {
  if (valueCount > 1) {
    if (operator === 'is') return 'is any of';
    if (operator === 'is not') return 'is none of';
    return operator;
  }

  if (operator === 'is any of') return 'is';
  if (operator === 'is none of') return 'is not';
  return operator;
}

export function normalizeMultiOptionOperator(
  operator: MultiOptionFilterOperator,
  valueCount: number,
): MultiOptionFilterOperator {
  if (valueCount > 1) {
    if (operator === 'include') return 'include any of';
    if (operator === 'exclude') return 'exclude if any of';
    return operator;
  }

  if (operator === 'exclude if any of' || operator === 'exclude if all') {
    return 'exclude';
  }

  if (operator === 'include any of' || operator === 'include all of') {
    return 'include';
  }

  return operator;
}

function setEquals(a: string[], b: string[]) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  return aSet.size === bSet.size && [...aSet].every((value) => bSet.has(value));
}

export function optionColumnValues(
  filters: FlightFilters,
  columnId: OptionColumnId,
): string[] {
  return filters[columnId];
}

export function rawOptionColumnOperator(
  filters: FlightFilters,
  columnId: 'passengers',
): MultiOptionFilterOperator;
export function rawOptionColumnOperator(
  filters: FlightFilters,
  columnId: NonPassengerOptionColumnId,
): OptionFilterOperator;
export function rawOptionColumnOperator(
  filters: FlightFilters,
  columnId: OptionColumnId,
): OptionFilterOperator | MultiOptionFilterOperator {
  switch (columnId) {
    case 'years':
      return filters.yearsOperator;
    case 'passengers':
      return filters.passengersOperator;
    case 'departureAirports':
      return filters.departureAirportsOperator;
    case 'arrivalAirports':
      return filters.arrivalAirportsOperator;
    case 'reasons':
      return filters.reasonsOperator;
    case 'airline':
      return filters.airlineOperator;
    case 'aircraft':
      return filters.aircraftOperator;
    case 'aircraftRegs':
      return filters.aircraftRegsOperator;
  }
}

export function optionColumnOperator(
  filters: FlightFilters,
  columnId: 'passengers',
): MultiOptionFilterOperator;
export function optionColumnOperator(
  filters: FlightFilters,
  columnId: NonPassengerOptionColumnId,
): OptionFilterOperator;
export function optionColumnOperator(
  filters: FlightFilters,
  columnId: OptionColumnId,
): OptionFilterOperator | MultiOptionFilterOperator {
  const valueCount = optionColumnValues(filters, columnId).length;
  return columnId === 'passengers'
    ? normalizeMultiOptionOperator(filters.passengersOperator, valueCount)
    : normalizeOptionOperator(
        rawOptionColumnOperator(filters, columnId),
        valueCount,
      );
}

export function setOptionColumnOperator(
  filters: FlightFilters,
  columnId: 'passengers',
  operator: MultiOptionFilterOperator,
): FlightFilters;
export function setOptionColumnOperator(
  filters: FlightFilters,
  columnId: NonPassengerOptionColumnId,
  operator: OptionFilterOperator,
): FlightFilters;
export function setOptionColumnOperator(
  filters: FlightFilters,
  columnId: OptionColumnId,
  operator: OptionFilterOperator | MultiOptionFilterOperator,
): FlightFilters {
  switch (columnId) {
    case 'years':
      return cloneFlightFilters(filters, {
        yearsOperator: operator as OptionFilterOperator,
      });
    case 'passengers':
      return cloneFlightFilters(filters, {
        passengersOperator: operator as MultiOptionFilterOperator,
      });
    case 'departureAirports':
      return cloneFlightFilters(filters, {
        departureAirportsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalAirports':
      return cloneFlightFilters(filters, {
        arrivalAirportsOperator: operator as OptionFilterOperator,
      });
    case 'reasons':
      return cloneFlightFilters(filters, {
        reasonsOperator: operator as OptionFilterOperator,
      });
    case 'airline':
      return cloneFlightFilters(filters, {
        airlineOperator: operator as OptionFilterOperator,
      });
    case 'aircraft':
      return cloneFlightFilters(filters, {
        aircraftOperator: operator as OptionFilterOperator,
      });
    case 'aircraftRegs':
      return cloneFlightFilters(filters, {
        aircraftRegsOperator: operator as OptionFilterOperator,
      });
  }
}

function normalizeOperatorForCount(
  filters: FlightFilters,
  columnId: OptionColumnId,
  valueCount: number,
) {
  if (columnId === 'passengers') {
    return normalizeMultiOptionOperator(filters.passengersOperator, valueCount);
  }

  return normalizeOptionOperator(
    rawOptionColumnOperator(filters, columnId),
    valueCount,
  );
}

export function setOptionColumnValues(
  filters: FlightFilters,
  columnId: OptionColumnId,
  values: string[],
): FlightFilters {
  const operator = normalizeOperatorForCount(filters, columnId, values.length);

  switch (columnId) {
    case 'years':
      return cloneFlightFilters(filters, {
        years: values,
        yearsOperator: operator as OptionFilterOperator,
      });
    case 'passengers':
      return cloneFlightFilters(filters, {
        passengers: values,
        passengersOperator: operator as MultiOptionFilterOperator,
      });
    case 'departureAirports':
      return cloneFlightFilters(filters, {
        departureAirports: values,
        departureAirportsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalAirports':
      return cloneFlightFilters(filters, {
        arrivalAirports: values,
        arrivalAirportsOperator: operator as OptionFilterOperator,
      });
    case 'reasons':
      return cloneFlightFilters(filters, {
        reasons: values,
        reasonsOperator: operator as OptionFilterOperator,
      });
    case 'airline':
      return cloneFlightFilters(filters, {
        airline: values,
        airlineOperator: operator as OptionFilterOperator,
      });
    case 'aircraft':
      return cloneFlightFilters(filters, {
        aircraft: values,
        aircraftOperator: operator as OptionFilterOperator,
      });
    case 'aircraftRegs':
      return cloneFlightFilters(filters, {
        aircraftRegs: values,
        aircraftRegsOperator: operator as OptionFilterOperator,
      });
  }
}

export function clearFilterColumn(
  filters: FlightFilters,
  columnId: FilterColumnId,
): FlightFilters {
  if (columnId === 'date') {
    return cloneFlightFilters(filters, {
      ...(filters.excludedValues?.years
        ? { excludedValues: { ...filters.excludedValues, years: [] } }
        : {}),
      years: [],
      fromDate: undefined,
      toDate: undefined,
    });
  }

  return setOptionColumnValues(
    cloneFlightFilters(filters, {
      excludedValues: { ...filters.excludedValues, [columnId]: [] },
    }),
    columnId,
    [],
  );
}

export function isFilterColumnActive(
  filters: FlightFilters,
  columnId: FilterColumnId,
): boolean {
  if (columnId === 'date') {
    return !!(
      filters.years.length ||
      filters.excludedValues?.years?.length ||
      filters.fromDate ||
      filters.toDate
    );
  }

  return (
    optionColumnValues(filters, columnId).length > 0 ||
    !!filters.excludedValues?.[columnId]?.length
  );
}

/*
 * The years a date filter selects, or an empty list when it selects something
 * else: no date, a custom range, or "every year but".
 */
export function selectedFilterYears(filters: FlightFilters): string[] {
  if (filters.years.length) {
    return filters.yearsOperator === 'is' ||
      filters.yearsOperator === 'is any of'
      ? filters.years
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
  return selectedFilterYears(filters).length
    ? clearFilterColumn(filters, 'date')
    : filters;
}

/* Filters to one year, or back to all years if that is the only one selected. */
export function toggleFilterYear(
  filters: FlightFilters,
  year: string,
): FlightFilters {
  const selected = selectedFilterYears(filters);
  if (selected.length === 1 && selected[0] === year) {
    return clearFilterColumn(filters, 'date');
  }
  return cloneFlightFilters(filters, {
    ...(filters.excludedValues?.years
      ? { excludedValues: { ...filters.excludedValues, years: [] } }
      : {}),
    years: [year],
    yearsOperator: 'is',
    fromDate: undefined,
    toDate: undefined,
  });
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
  if (filters.years.length) {
    if (filters.years.length <= 2) return filters.years.join(', ');
    return `${filters.years.slice(0, 2).join(', ')} +${filters.years.length - 2}`;
  }

  if (filters.fromDate && filters.toDate) {
    if (filters.fromDate.compare(filters.toDate) === 0) {
      return formatDateLabel(filters.fromDate, prefs);
    }
    return `${formatDateLabel(filters.fromDate, prefs)} - ${formatDateLabel(filters.toDate, prefs)}`;
  }
  if (filters.fromDate)
    return `From ${formatDateLabel(filters.fromDate, prefs)}`;
  if (filters.toDate) return `Until ${formatDateLabel(filters.toDate, prefs)}`;
  return 'Choose date';
}

function calendarDateToDate(value: CalendarDate) {
  return new Date(value.year, value.month - 1, value.day);
}

function dateToCalendarDate(value: Date) {
  return new CalendarDate(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
  );
}

function isSameCalendarDate(a: CalendarDate, b: CalendarDate) {
  return a.compare(b) === 0;
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

function normalizeDateRange(
  fromDate: CalendarDate,
  toDate: CalendarDate,
): [CalendarDate, CalendarDate] {
  return fromDate.compare(toDate) <= 0
    ? [fromDate, toDate]
    : [toDate, fromDate];
}

function stringValues(filter: FilterModel) {
  return filter.values
    .map((value) => (typeof value === 'string' ? value : undefined))
    .filter((value): value is string => !!value);
}

function firstDateValue(filter: FilterModel) {
  const value = filter.values[0];
  return value instanceof Date ? dateToCalendarDate(value) : undefined;
}

function optionFilter(
  columnId: string,
  values: string[],
  operator: OptionFilterOperator = values.length > 1 ? 'is any of' : 'is',
): FilterModel<'option'> | undefined {
  if (!values.length) return undefined;
  return {
    columnId,
    type: 'option',
    operator,
    values,
  };
}

function multiOptionFilter(
  columnId: string,
  values: string[],
  operator: MultiOptionFilterOperator = values.length > 1
    ? 'include any of'
    : 'include',
): FilterModel<'multiOption'> | undefined {
  if (!values.length) return undefined;
  return {
    columnId,
    type: 'multiOption',
    operator,
    values,
  };
}

function dateFilterFromFlightFilters(
  source: FlightFilters,
): FilterModel<'date'> | FilterModel<'option'> | undefined {
  if (source.years.length) {
    return {
      columnId: 'year',
      type: 'option',
      operator: source.yearsOperator,
      values: source.years,
    };
  }

  if (
    source.fromDate &&
    source.toDate &&
    isFullYearRange(source.fromDate, source.toDate)
  ) {
    return {
      columnId: 'year',
      type: 'option',
      operator: 'is',
      values: [source.fromDate.year.toString()],
    };
  }

  if (source.fromDate && source.toDate) {
    const [fromDate, toDate] = normalizeDateRange(
      source.fromDate,
      source.toDate,
    );

    if (isSameCalendarDate(fromDate, toDate)) {
      return {
        columnId: 'date',
        type: 'date',
        operator: 'is',
        values: [calendarDateToDate(fromDate)],
      };
    }

    return {
      columnId: 'date',
      type: 'date',
      operator: 'is between',
      values: [calendarDateToDate(fromDate), calendarDateToDate(toDate)],
    };
  }

  if (source.fromDate) {
    return {
      columnId: 'date',
      type: 'date',
      operator: 'is on or after',
      values: [calendarDateToDate(source.fromDate)],
    };
  }

  if (source.toDate) {
    return {
      columnId: 'date',
      type: 'date',
      operator: 'is on or before',
      values: [calendarDateToDate(source.toDate)],
    };
  }
}

export function flightFiltersToBits(source: FlightFilters): FiltersState {
  const nextFilters: FiltersState = [];

  for (const filter of [
    optionFilter(
      'departureAirports',
      source.departureAirports,
      source.departureAirportsOperator,
    ),
    optionFilter(
      'arrivalAirports',
      source.arrivalAirports,
      source.arrivalAirportsOperator,
    ),
    dateFilterFromFlightFilters(source),
    multiOptionFilter(
      'passengers',
      source.passengers,
      source.passengersOperator,
    ),
    optionFilter('reasons', source.reasons, source.reasonsOperator),
    optionFilter('airline', source.airline, source.airlineOperator),
    optionFilter('aircraft', source.aircraft, source.aircraftOperator),
    optionFilter(
      'aircraftRegs',
      source.aircraftRegs,
      source.aircraftRegsOperator,
    ),
  ]) {
    if (filter) nextFilters.push(filter);
  }

  for (const [column, values] of Object.entries(source.excludedValues ?? {})) {
    const filter = optionFilter(column + 'Excluded', values, 'is none of');
    if (filter) nextFilters.push(filter);
  }
  return nextFilters;
}

function applyDateFilter(target: FlightFilters, filter: FilterModel) {
  if (filter.columnId !== 'date') return;

  const firstDate = firstDateValue(filter);
  const secondValue = filter.values[1];
  const secondDate =
    secondValue instanceof Date ? dateToCalendarDate(secondValue) : undefined;

  if (!firstDate) return;

  switch (filter.operator) {
    case 'is':
      target.fromDate = firstDate;
      target.toDate = firstDate;
      break;
    case 'is before':
      target.toDate = firstDate.subtract({ days: 1 });
      break;
    case 'is on or before':
      target.toDate = firstDate;
      break;
    case 'is after':
      target.fromDate = firstDate.add({ days: 1 });
      break;
    case 'is on or after':
      target.fromDate = firstDate;
      break;
    case 'is between':
      if (secondDate) {
        const [fromDate, toDate] = normalizeDateRange(firstDate, secondDate);
        target.fromDate = fromDate;
        target.toDate = toDate;
      }
      break;
  }
}

function resetBitsManagedFilters(base?: FlightFilters): FlightFilters {
  return cloneFlightFilters(base ?? createDefaultFilters(), {
    departureAirports: [],
    departureAirportsOperator: 'is any of',
    arrivalAirports: [],
    arrivalAirportsOperator: 'is any of',
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    reasons: [],
    reasonsOperator: 'is any of',
    airline: [],
    airlineOperator: 'is any of',
    aircraft: [],
    aircraftOperator: 'is any of',
    aircraftRegs: [],
    aircraftRegsOperator: 'is any of',
  });
}

export function bitsFiltersToFlightFilters(
  source: FiltersState,
  base?: FlightFilters,
): FlightFilters {
  const nextFilters = resetBitsManagedFilters(base);
  const excludedValues: NonNullable<FlightFilters['excludedValues']> = {};
  const dateFilters: FilterModel[] = [];

  for (const filter of source) {
    if (filter.columnId.endsWith('Excluded')) {
      const column = filter.columnId.slice(0, -8) as OptionColumnId;
      if (
        [
          'departureAirports',
          'arrivalAirports',
          'years',
          'passengers',
          'reasons',
          'airline',
          'aircraft',
          'aircraftRegs',
        ].includes(column)
      ) {
        excludedValues[column] = stringValues(filter);
      }
      continue;
    }
    switch (filter.columnId) {
      case 'departureAirports':
        nextFilters.departureAirports = stringValues(filter);
        nextFilters.departureAirportsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'arrivalAirports':
        nextFilters.arrivalAirports = stringValues(filter);
        nextFilters.arrivalAirportsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'passengers':
        nextFilters.passengers = stringValues(filter);
        nextFilters.passengersOperator =
          filter.operator as MultiOptionFilterOperator;
        break;
      case 'reasons':
        nextFilters.reasons = stringValues(filter);
        nextFilters.reasonsOperator = filter.operator as OptionFilterOperator;
        break;
      case 'airline':
        nextFilters.airline = stringValues(filter);
        nextFilters.airlineOperator = filter.operator as OptionFilterOperator;
        break;
      case 'aircraft':
        nextFilters.aircraft = stringValues(filter);
        nextFilters.aircraftOperator = filter.operator as OptionFilterOperator;
        break;
      case 'aircraftRegs':
        nextFilters.aircraftRegs = stringValues(filter);
        nextFilters.aircraftRegsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'year':
        nextFilters.years = stringValues(filter);
        nextFilters.yearsOperator = normalizeOptionOperator(
          filter.operator as OptionFilterOperator,
          nextFilters.years.length,
        );
        break;
      case 'date':
        dateFilters.push(filter);
        break;
    }
  }

  if (Object.keys(excludedValues).length)
    nextFilters.excludedValues = excludedValues;
  else delete nextFilters.excludedValues;
  dateFilters.forEach((filter) => applyDateFilter(nextFilters, filter));

  return nextFilters;
}

function serializeFilterValue(value: unknown) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
  }

  return String(value);
}

export function bitsSignature(source: FiltersState) {
  return JSON.stringify(
    source.map((filter) => ({
      columnId: filter.columnId,
      type: filter.type,
      operator: filter.operator,
      values: filter.values.map(serializeFilterValue),
    })),
  );
}

export function flightSignature(source: FlightFilters) {
  return JSON.stringify({
    excludedValues: source.excludedValues,
    departureAirports: source.departureAirports,
    departureAirportsOperator: source.departureAirportsOperator,
    arrivalAirports: source.arrivalAirports,
    arrivalAirportsOperator: source.arrivalAirportsOperator,
    airportsEither: source.airportsEither,
    routes: source.routes,
    years: source.years,
    yearsOperator: source.yearsOperator,
    fromDate: source.fromDate?.toString(),
    toDate: source.toDate?.toString(),
    passengers: source.passengers,
    passengersOperator: source.passengersOperator,
    reasons: source.reasons,
    reasonsOperator: source.reasonsOperator,
    airline: source.airline,
    airlineOperator: source.airlineOperator,
    aircraft: source.aircraft,
    aircraftOperator: source.aircraftOperator,
    aircraftRegs: source.aircraftRegs,
    aircraftRegsOperator: source.aircraftRegsOperator,
  });
}

export function routeMatches(flight: FlightData, route: Route): boolean {
  return routeMatchesEndpoints(flight.from?.id, flight.to?.id, route);
}

export function optionMatches(
  value: string | null | undefined,
  selectedValues: string[],
  operator: OptionFilterOperator = 'is any of',
) {
  if (!selectedValues.length) return true;

  const found = value ? selectedValues.includes(value) : false;

  switch (operator) {
    case 'is':
    case 'is any of':
      return found;
    case 'is not':
    case 'is none of':
      return !found;
  }
}

export function multiOptionMatches(
  values: string[],
  selectedValues: string[],
  operator: MultiOptionFilterOperator = 'include any of',
) {
  if (!selectedValues.length) return true;

  const present = new Set(values);
  const hasAny = selectedValues.some((value) => present.has(value));
  const hasAll = selectedValues.every((value) => present.has(value));

  switch (operator) {
    case 'include':
    case 'include any of':
      return hasAny;
    case 'exclude':
    case 'exclude if any of':
      return !hasAny;
    case 'include all of':
      return hasAll;
    case 'exclude if all':
      return !hasAll;
    case 'include exactly':
      return setEquals(values, selectedValues);
    case 'exclude exactly':
      return !setEquals(values, selectedValues);
  }
}

export function matchesLocationFilters(
  flight: FlightData,
  locationFilters: LocationFilters,
) {
  if (
    locationFilters.excludedValues?.departureAirports?.includes(
      flight.from?.id.toString() ?? '',
    ) ||
    locationFilters.excludedValues?.arrivalAirports?.includes(
      flight.to?.id.toString() ?? '',
    )
  )
    return false;
  const fromId = flight.from?.id.toString();
  const toId = flight.to?.id.toString();
  const departureAirports = locationFilters.departureAirports ?? [];
  const arrivalAirports = locationFilters.arrivalAirports ?? [];

  if (
    !optionMatches(
      fromId,
      departureAirports,
      locationFilters.departureAirportsOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      toId,
      arrivalAirports,
      locationFilters.arrivalAirportsOperator,
    )
  ) {
    return false;
  }

  if (
    locationFilters.airportsEither.length &&
    (!fromId ||
      !toId ||
      ![fromId, toId].some((id) => locationFilters.airportsEither.includes(id)))
  ) {
    return false;
  }

  if (
    locationFilters.routes.length &&
    !locationFilters.routes.some((route) => routeMatches(flight, route))
  ) {
    return false;
  }

  return true;
}

function getFilterBoundary(
  date: NonNullable<FlightFilters['fromDate']>,
  tzId: string,
  end = false,
) {
  return parseLocalISO(
    `${date.toString()}T${end ? '23:59:59.999' : '00:00'}`,
    tzId,
  );
}

export function matchesNonLocationFilters(
  flight: FlightData,
  filters: FlightFilters,
  userId: string | null | undefined = page.data.user?.id,
) {
  const excluded = filters.excludedValues;
  if (excluded) {
    const values = {
      years: flight.date?.getFullYear().toString(),
      reasons: flightReasonForUser(flight, userId),
      airline: flight.airline?.name,
      aircraft: flight.aircraft?.name,
      aircraftRegs: flight.aircraftReg,
    };
    if (
      Object.entries(values).some(
        ([key, value]) =>
          value != null &&
          excluded[key as keyof typeof values]?.includes(value),
      )
    )
      return false;
    if (
      flight.passengers.some((passenger) =>
        excluded.passengers?.includes(getFlightPassengerToken(passenger) ?? ''),
      )
    )
      return false;
  }
  if (
    !optionMatches(
      flight.date?.getFullYear().toString(),
      filters.years,
      filters.yearsOperator,
    )
  ) {
    return false;
  }

  if (
    filters.fromDate &&
    (!flight.dateEnd ||
      isBefore(
        flight.dateEnd,
        getFilterBoundary(filters.fromDate, flight.dateEnd.timeZone ?? 'UTC'),
      ))
  ) {
    return false;
  }

  if (
    filters.toDate &&
    (!flight.dateStart ||
      isAfter(
        flight.dateStart,
        getFilterBoundary(
          filters.toDate,
          flight.dateStart.timeZone ?? 'UTC',
          true,
        ),
      ))
  ) {
    return false;
  }

  if (
    !multiOptionMatches(
      flight.passengers
        .map((passenger) => getFlightPassengerToken(passenger))
        .filter((token): token is string => !!token),
      filters.passengers,
      filters.passengersOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      flightReasonForUser(flight, userId),
      filters.reasons,
      filters.reasonsOperator,
    )
  )
    return false;

  if (
    !optionMatches(
      flight.airline?.name,
      filters.airline,
      filters.airlineOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      flight.aircraft?.name,
      filters.aircraft,
      filters.aircraftOperator,
    )
  ) {
    return false;
  }

  if (
    !optionMatches(
      flight.aircraftReg,
      filters.aircraftRegs,
      filters.aircraftRegsOperator,
    )
  ) {
    return false;
  }

  return true;
}

export function matchesFlight(
  flight: FlightData,
  filters: FlightFilters,
  userId: string | null | undefined = page.data.user?.id,
) {
  return (
    matchesLocationFilters(flight, filters) &&
    matchesNonLocationFilters(flight, filters, userId)
  );
}

// Reasons belong to passengers; never fall back to another passenger's reason.
export function flightReasonForUser(
  flight: Pick<FlightData, 'passengers'>,
  userId?: string | null,
): string | null {
  if (!userId) return null;
  return (
    flight.passengers.find((passenger) => passenger.userId === userId)
      ?.flightReason ?? null
  );
}

export function flightReasonFilterOptions(
  flights: Pick<FlightData, 'passengers'>[],
  userId?: string | null,
) {
  const counts = new Map<string, number>();
  for (const flight of flights) {
    const reason = flightReasonForUser(flight, userId);
    if (!reason?.trim()) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({
    value,
    label: FlightReasons.some((builtin) => builtin === value)
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value,
    count,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Read legacy category operators as per-value states without changing saved filters. */
export function optionValueState(
  filters: FlightFilters,
  column: OptionColumnId,
  value: string,
): 'unselected' | 'include' | 'exclude' {
  if (filters.excludedValues?.[column]?.includes(value)) return 'exclude';
  if (
    column === 'years' &&
    !filters.years.length &&
    selectedFilterYears(filters).includes(value)
  )
    return 'include';
  if (!filters[column].includes(value)) return 'unselected';
  const operator =
    column === 'passengers'
      ? filters.passengersOperator
      : rawOptionColumnOperator(filters, column);
  return operator.startsWith('exclude') ||
    operator === 'is not' ||
    operator === 'is none of'
    ? 'exclude'
    : 'include';
}

export function cycleOptionValue(
  filters: FlightFilters,
  column: OptionColumnId,
  value: string,
): FlightFilters {
  const state = optionValueState(filters, column, value);
  const currentValues =
    column === 'years' && !filters.years.length
      ? selectedFilterYears(filters)
      : filters[column];
  const included = currentValues.filter(
    (item) =>
      item !== value && optionValueState(filters, column, item) === 'include',
  );
  const excluded = [
    ...new Set([
      ...(filters.excludedValues?.[column] ?? []),
      ...filters[column].filter(
        (item) => optionValueState(filters, column, item) === 'exclude',
      ),
    ]),
  ].filter((item) => item !== value);
  if (state === 'unselected') included.push(value);
  if (state === 'include') excluded.push(value);
  const excludedValues = { ...filters.excludedValues };
  if (excluded.length) excludedValues[column] = excluded;
  else delete excludedValues[column];
  const next = cloneFlightFilters(filters, {
    [column]: included,
    ...(column === 'years' ? { fromDate: undefined, toDate: undefined } : {}),
    excludedValues,
  });
  if (column === 'passengers')
    return setOptionColumnOperator(
      next,
      column,
      normalizeMultiOptionOperator('include any of', included.length),
    );
  return setOptionColumnOperator(
    next,
    column,
    normalizeOptionOperator('is any of', included.length),
  );
}
