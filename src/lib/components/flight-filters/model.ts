import { CalendarDate } from '@internationalized/date';
import type { FilterModel, FiltersState } from 'bits-ui';
import { isAfter, isBefore } from 'date-fns';

import { durationBucketFor } from './options';
import {
  normalizeRoute,
  routeFromKey,
  routeKey,
  routeMatchesEndpoints,
  type FilterLogic,
  type FlightFilters,
  type LocationFilters,
  type MultiOptionFilterOperator,
  type OptionFilterOperator,
  type Route,
} from './types';

import { type FlightPassenger } from '$lib/db/types';
import { getFlightPassengerToken, type FlightData } from '$lib/utils';
import { parseLocalISO } from '$lib/utils/datetime';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';

export type FilterColumnId =
  | 'departureAirports'
  | 'arrivalAirports'
  | 'routes'
  | 'departureCountries'
  | 'arrivalCountries'
  | 'departureContinents'
  | 'arrivalContinents'
  | 'date'
  | 'passengers'
  | 'airline'
  | 'aircraft'
  | 'aircraftRegs'
  | 'flightType'
  | 'flightNumber'
  | 'duration'
  | 'seatClass'
  | 'flightReason'
  | 'seatType'
  | 'seatNumber'
  | 'months'
  | 'days';

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
    routesOperator: 'is any of',
    departureCountries: [],
    departureCountriesOperator: 'is any of',
    arrivalCountries: [],
    arrivalCountriesOperator: 'is any of',
    departureContinents: [],
    departureContinentsOperator: 'is any of',
    arrivalContinents: [],
    arrivalContinentsOperator: 'is any of',
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    airline: [],
    airlineOperator: 'is any of',
    aircraft: [],
    aircraftOperator: 'is any of',
    aircraftRegs: [],
    aircraftRegsOperator: 'is any of',
    flightType: [],
    flightTypeOperator: 'is any of',
    flightNumber: [],
    flightNumberOperator: 'is any of',
    duration: [],
    durationOperator: 'is any of',
    seatClass: [],
    seatClassOperator: 'is any of',
    flightReason: [],
    flightReasonOperator: 'is any of',
    seatType: [],
    seatTypeOperator: 'is any of',
    seatNumber: [],
    seatNumberOperator: 'is any of',
    months: [],
    monthsOperator: 'is any of',
    days: [],
    daysOperator: 'is any of',
    logic: 'and',
    noteQuery: '',
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
    departureCountries: [...source.departureCountries],
    arrivalCountries: [...source.arrivalCountries],
    departureContinents: [...source.departureContinents],
    arrivalContinents: [...source.arrivalContinents],
    years: [...source.years],
    passengers: [...source.passengers],
    airline: [...source.airline],
    aircraft: [...source.aircraft],
    aircraftRegs: [...source.aircraftRegs],
    flightType: [...source.flightType],
    flightNumber: [...source.flightNumber],
    duration: [...source.duration],
    seatClass: [...source.seatClass],
    flightReason: [...source.flightReason],
    seatType: [...source.seatType],
    seatNumber: [...source.seatNumber],
    months: [...source.months],
    days: [...source.days],
    ...next,
  };
}

export function hasFlightFilters(filters: FlightFilters | undefined): boolean {
  return !!(
    filters &&
    (filters.departureAirports.length > 0 ||
      filters.arrivalAirports.length > 0 ||
      filters.airportsEither.length > 0 ||
      filters.routes.length > 0 ||
      filters.departureCountries.length > 0 ||
      filters.arrivalCountries.length > 0 ||
      filters.departureContinents.length > 0 ||
      filters.arrivalContinents.length > 0 ||
      filters.years.length > 0 ||
      filters.fromDate ||
      filters.toDate ||
      filters.passengers.length > 0 ||
      filters.airline.length > 0 ||
      filters.aircraft.length > 0 ||
      filters.aircraftRegs.length > 0 ||
      filters.flightType.length > 0 ||
      filters.flightNumber.length > 0 ||
      filters.duration.length > 0 ||
      filters.seatClass.length > 0 ||
      filters.flightReason.length > 0 ||
      filters.seatType.length > 0 ||
      filters.seatNumber.length > 0 ||
      filters.months.length > 0 ||
      filters.days.length > 0 ||
      filters.noteQuery.trim().length > 0)
  );
}

/*
 * Combines per-dimension results: AND needs every active filter to match, OR
 * needs one. With nothing active there is nothing to fail on.
 */
function combineFilterResults(
  results: boolean[],
  logic: FilterLogic = 'and',
): boolean {
  if (!results.length) return true;
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

/*
 * The number of dimensions with values selected. The logic toggle only
 * changes results from two active dimensions on.
 */
export function activeFilterCount(filters: FlightFilters): number {
  let count = 0;
  if (filters.departureAirports.length) count++;
  if (filters.arrivalAirports.length) count++;
  if (filters.airportsEither.length) count++;
  if (filters.routes.length) count++;
  if (filters.departureCountries.length) count++;
  if (filters.arrivalCountries.length) count++;
  if (filters.departureContinents.length) count++;
  if (filters.arrivalContinents.length) count++;
  if (filters.years.length) count++;
  if (filters.fromDate || filters.toDate) count++;
  if (filters.passengers.length) count++;
  if (filters.airline.length) count++;
  if (filters.aircraft.length) count++;
  if (filters.aircraftRegs.length) count++;
  if (filters.flightType.length) count++;
  if (filters.flightNumber.length) count++;
  if (filters.duration.length) count++;
  if (filters.seatClass.length) count++;
  if (filters.flightReason.length) count++;
  if (filters.seatType.length) count++;
  if (filters.seatNumber.length) count++;
  if (filters.months.length) count++;
  if (filters.days.length) count++;
  if (filters.noteQuery.trim()) count++;
  return count;
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
  if (columnId === 'routes') return filters.routes.map(routeKey);
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
    case 'passengers':
      return filters.passengersOperator;
    case 'departureAirports':
      return filters.departureAirportsOperator;
    case 'arrivalAirports':
      return filters.arrivalAirportsOperator;
    case 'routes':
      return filters.routesOperator;
    case 'departureCountries':
      return filters.departureCountriesOperator;
    case 'arrivalCountries':
      return filters.arrivalCountriesOperator;
    case 'departureContinents':
      return filters.departureContinentsOperator;
    case 'arrivalContinents':
      return filters.arrivalContinentsOperator;
    case 'airline':
      return filters.airlineOperator;
    case 'aircraft':
      return filters.aircraftOperator;
    case 'aircraftRegs':
      return filters.aircraftRegsOperator;
    case 'flightType':
      return filters.flightTypeOperator;
    case 'flightNumber':
      return filters.flightNumberOperator;
    case 'duration':
      return filters.durationOperator;
    case 'seatClass':
      return filters.seatClassOperator;
    case 'flightReason':
      return filters.flightReasonOperator;
    case 'seatType':
      return filters.seatTypeOperator;
    case 'seatNumber':
      return filters.seatNumberOperator;
    case 'months':
      return filters.monthsOperator;
    case 'days':
      return filters.daysOperator;
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
    case 'routes':
      return cloneFlightFilters(filters, {
        routesOperator: operator as OptionFilterOperator,
      });
    case 'departureCountries':
      return cloneFlightFilters(filters, {
        departureCountriesOperator: operator as OptionFilterOperator,
      });
    case 'arrivalCountries':
      return cloneFlightFilters(filters, {
        arrivalCountriesOperator: operator as OptionFilterOperator,
      });
    case 'departureContinents':
      return cloneFlightFilters(filters, {
        departureContinentsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalContinents':
      return cloneFlightFilters(filters, {
        arrivalContinentsOperator: operator as OptionFilterOperator,
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
    case 'flightType':
      return cloneFlightFilters(filters, {
        flightTypeOperator: operator as OptionFilterOperator,
      });
    case 'flightNumber':
      return cloneFlightFilters(filters, {
        flightNumberOperator: operator as OptionFilterOperator,
      });
    case 'duration':
      return cloneFlightFilters(filters, {
        durationOperator: operator as OptionFilterOperator,
      });
    case 'seatClass':
      return cloneFlightFilters(filters, {
        seatClassOperator: operator as OptionFilterOperator,
      });
    case 'flightReason':
      return cloneFlightFilters(filters, {
        flightReasonOperator: operator as OptionFilterOperator,
      });
    case 'seatType':
      return cloneFlightFilters(filters, {
        seatTypeOperator: operator as OptionFilterOperator,
      });
    case 'seatNumber':
      return cloneFlightFilters(filters, {
        seatNumberOperator: operator as OptionFilterOperator,
      });
    case 'months':
      return cloneFlightFilters(filters, {
        monthsOperator: operator as OptionFilterOperator,
      });
    case 'days':
      return cloneFlightFilters(filters, {
        daysOperator: operator as OptionFilterOperator,
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
    case 'routes':
      return cloneFlightFilters(filters, {
        routes: values.map(routeFromKey),
        routesOperator: operator as OptionFilterOperator,
      });
    case 'departureCountries':
      return cloneFlightFilters(filters, {
        departureCountries: values,
        departureCountriesOperator: operator as OptionFilterOperator,
      });
    case 'arrivalCountries':
      return cloneFlightFilters(filters, {
        arrivalCountries: values,
        arrivalCountriesOperator: operator as OptionFilterOperator,
      });
    case 'departureContinents':
      return cloneFlightFilters(filters, {
        departureContinents: values,
        departureContinentsOperator: operator as OptionFilterOperator,
      });
    case 'arrivalContinents':
      return cloneFlightFilters(filters, {
        arrivalContinents: values,
        arrivalContinentsOperator: operator as OptionFilterOperator,
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
    case 'flightType':
      return cloneFlightFilters(filters, {
        flightType: values,
        flightTypeOperator: operator as OptionFilterOperator,
      });
    case 'flightNumber':
      return cloneFlightFilters(filters, {
        flightNumber: values,
        flightNumberOperator: operator as OptionFilterOperator,
      });
    case 'duration':
      return cloneFlightFilters(filters, {
        duration: values,
        durationOperator: operator as OptionFilterOperator,
      });
    case 'seatClass':
      return cloneFlightFilters(filters, {
        seatClass: values,
        seatClassOperator: operator as OptionFilterOperator,
      });
    case 'flightReason':
      return cloneFlightFilters(filters, {
        flightReason: values,
        flightReasonOperator: operator as OptionFilterOperator,
      });
    case 'seatType':
      return cloneFlightFilters(filters, {
        seatType: values,
        seatTypeOperator: operator as OptionFilterOperator,
      });
    case 'seatNumber':
      return cloneFlightFilters(filters, {
        seatNumber: values,
        seatNumberOperator: operator as OptionFilterOperator,
      });
    case 'months':
      return cloneFlightFilters(filters, {
        months: values,
        monthsOperator: operator as OptionFilterOperator,
      });
    case 'days':
      return cloneFlightFilters(filters, {
        days: values,
        daysOperator: operator as OptionFilterOperator,
      });
  }
}

export function clearFilterColumn(
  filters: FlightFilters,
  columnId: FilterColumnId,
): FlightFilters {
  if (columnId === 'date') {
    return cloneFlightFilters(filters, {
      years: [],
      fromDate: undefined,
      toDate: undefined,
    });
  }

  return setOptionColumnValues(filters, columnId, []);
}

export function isFilterColumnActive(
  filters: FlightFilters,
  columnId: FilterColumnId,
): boolean {
  if (columnId === 'date') {
    return !!(filters.years.length || filters.fromDate || filters.toDate);
  }

  return optionColumnValues(filters, columnId).length > 0;
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
    years: [year],
    yearsOperator: 'is',
    fromDate: undefined,
    toDate: undefined,
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

/* Today in the user's local timezone. */
export function todayCalendarDate(): CalendarDate {
  const now = new Date();
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/*
 * The date range a preset stands for, resolved against `today`. Rolling
 * windows are fixed at apply time; they do not advance on later days.
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

/* Applies a preset as a date range, replacing any existing date filter. */
export function applyDatePreset(
  filters: FlightFilters,
  id: DatePresetId,
  today: CalendarDate,
): FlightFilters {
  const range = datePresetRange(id, today);
  return cloneFlightFilters(filters, {
    years: [],
    fromDate: range.fromDate,
    toDate: range.toDate,
  });
}

/*
 * The preset whose exact range matches, if any. Rolling windows only match
 * on the day they were applied; custom ranges match none.
 */
export function activeDatePresetForRange(
  fromDate: CalendarDate | undefined,
  toDate: CalendarDate | undefined,
  today: CalendarDate,
): DatePresetId | undefined {
  for (const preset of datePresets) {
    const range = datePresetRange(preset.id, today);
    if (
      fromDate?.compare(range.fromDate) === 0 &&
      toDate?.compare(range.toDate) === 0
    ) {
      return preset.id;
    }
  }
}

/*
 * The preset currently in effect, if any. Rolling windows only match on the
 * day they were applied; custom ranges and other year selections match none.
 */
export function activeDatePreset(
  filters: FlightFilters,
  today: CalendarDate,
): DatePresetId | undefined {
  const years = selectedFilterYears(filters);
  if (years.length === 1) {
    if (years[0] === String(today.year)) return 'this-year';
    if (years[0] === String(today.year - 1)) return 'last-year';
  }

  return activeDatePresetForRange(filters.fromDate, filters.toDate, today);
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
    if (isFullYearRange(filters.fromDate, filters.toDate)) {
      return filters.fromDate.year.toString();
    }
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
    optionFilter('routes', source.routes.map(routeKey), source.routesOperator),
    optionFilter(
      'departureCountries',
      source.departureCountries,
      source.departureCountriesOperator,
    ),
    optionFilter(
      'arrivalCountries',
      source.arrivalCountries,
      source.arrivalCountriesOperator,
    ),
    optionFilter(
      'departureContinents',
      source.departureContinents,
      source.departureContinentsOperator,
    ),
    optionFilter(
      'arrivalContinents',
      source.arrivalContinents,
      source.arrivalContinentsOperator,
    ),
    dateFilterFromFlightFilters(source),
    multiOptionFilter(
      'passengers',
      source.passengers,
      source.passengersOperator,
    ),
    optionFilter('airline', source.airline, source.airlineOperator),
    optionFilter('aircraft', source.aircraft, source.aircraftOperator),
    optionFilter(
      'aircraftRegs',
      source.aircraftRegs,
      source.aircraftRegsOperator,
    ),
    optionFilter('flightType', source.flightType, source.flightTypeOperator),
    optionFilter(
      'flightNumber',
      source.flightNumber,
      source.flightNumberOperator,
    ),
    optionFilter('duration', source.duration, source.durationOperator),
    optionFilter('seatClass', source.seatClass, source.seatClassOperator),
    optionFilter(
      'flightReason',
      source.flightReason,
      source.flightReasonOperator,
    ),
    optionFilter('seatType', source.seatType, source.seatTypeOperator),
    optionFilter('seatNumber', source.seatNumber, source.seatNumberOperator),
    optionFilter('months', source.months, source.monthsOperator),
    optionFilter('days', source.days, source.daysOperator),
  ]) {
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
    routes: [],
    routesOperator: 'is any of',
    departureCountries: [],
    departureCountriesOperator: 'is any of',
    arrivalCountries: [],
    arrivalCountriesOperator: 'is any of',
    departureContinents: [],
    departureContinentsOperator: 'is any of',
    arrivalContinents: [],
    arrivalContinentsOperator: 'is any of',
    years: [],
    yearsOperator: 'is any of',
    fromDate: undefined,
    toDate: undefined,
    passengers: [],
    passengersOperator: 'include any of',
    airline: [],
    airlineOperator: 'is any of',
    aircraft: [],
    aircraftOperator: 'is any of',
    aircraftRegs: [],
    aircraftRegsOperator: 'is any of',
    flightType: [],
    flightTypeOperator: 'is any of',
    flightNumber: [],
    flightNumberOperator: 'is any of',
    duration: [],
    durationOperator: 'is any of',
    seatClass: [],
    seatClassOperator: 'is any of',
    flightReason: [],
    flightReasonOperator: 'is any of',
    seatType: [],
    seatTypeOperator: 'is any of',
    seatNumber: [],
    seatNumberOperator: 'is any of',
    months: [],
    monthsOperator: 'is any of',
    days: [],
    daysOperator: 'is any of',
  });
}

export function bitsFiltersToFlightFilters(
  source: FiltersState,
  base?: FlightFilters,
): FlightFilters {
  const nextFilters = resetBitsManagedFilters(base);
  const dateFilters: FilterModel[] = [];

  for (const filter of source) {
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
      case 'routes':
        nextFilters.routes = stringValues(filter).map(routeFromKey);
        nextFilters.routesOperator = filter.operator as OptionFilterOperator;
        break;
      case 'departureCountries':
        nextFilters.departureCountries = stringValues(filter);
        nextFilters.departureCountriesOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'arrivalCountries':
        nextFilters.arrivalCountries = stringValues(filter);
        nextFilters.arrivalCountriesOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'departureContinents':
        nextFilters.departureContinents = stringValues(filter);
        nextFilters.departureContinentsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'arrivalContinents':
        nextFilters.arrivalContinents = stringValues(filter);
        nextFilters.arrivalContinentsOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'passengers':
        nextFilters.passengers = stringValues(filter);
        nextFilters.passengersOperator =
          filter.operator as MultiOptionFilterOperator;
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
      case 'flightType':
        nextFilters.flightType = stringValues(filter);
        nextFilters.flightTypeOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'flightNumber':
        nextFilters.flightNumber = stringValues(filter);
        nextFilters.flightNumberOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'duration':
        nextFilters.duration = stringValues(filter);
        nextFilters.durationOperator = filter.operator as OptionFilterOperator;
        break;
      case 'seatClass':
        nextFilters.seatClass = stringValues(filter);
        nextFilters.seatClassOperator = filter.operator as OptionFilterOperator;
        break;
      case 'flightReason':
        nextFilters.flightReason = stringValues(filter);
        nextFilters.flightReasonOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'seatType':
        nextFilters.seatType = stringValues(filter);
        nextFilters.seatTypeOperator = filter.operator as OptionFilterOperator;
        break;
      case 'seatNumber':
        nextFilters.seatNumber = stringValues(filter);
        nextFilters.seatNumberOperator =
          filter.operator as OptionFilterOperator;
        break;
      case 'months':
        nextFilters.months = stringValues(filter);
        nextFilters.monthsOperator = filter.operator as OptionFilterOperator;
        break;
      case 'days':
        nextFilters.days = stringValues(filter);
        nextFilters.daysOperator = filter.operator as OptionFilterOperator;
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
    departureAirports: source.departureAirports,
    departureAirportsOperator: source.departureAirportsOperator,
    arrivalAirports: source.arrivalAirports,
    arrivalAirportsOperator: source.arrivalAirportsOperator,
    airportsEither: source.airportsEither,
    routes: source.routes,
    routesOperator: source.routesOperator,
    departureCountries: source.departureCountries,
    departureCountriesOperator: source.departureCountriesOperator,
    arrivalCountries: source.arrivalCountries,
    arrivalCountriesOperator: source.arrivalCountriesOperator,
    departureContinents: source.departureContinents,
    departureContinentsOperator: source.departureContinentsOperator,
    arrivalContinents: source.arrivalContinents,
    arrivalContinentsOperator: source.arrivalContinentsOperator,
    years: source.years,
    yearsOperator: source.yearsOperator,
    fromDate: source.fromDate?.toString(),
    toDate: source.toDate?.toString(),
    passengers: source.passengers,
    passengersOperator: source.passengersOperator,
    airline: source.airline,
    airlineOperator: source.airlineOperator,
    aircraft: source.aircraft,
    aircraftOperator: source.aircraftOperator,
    aircraftRegs: source.aircraftRegs,
    aircraftRegsOperator: source.aircraftRegsOperator,
    flightType: source.flightType,
    flightTypeOperator: source.flightTypeOperator,
    flightNumber: source.flightNumber,
    flightNumberOperator: source.flightNumberOperator,
    duration: source.duration,
    durationOperator: source.durationOperator,
    seatClass: source.seatClass,
    seatClassOperator: source.seatClassOperator,
    flightReason: source.flightReason,
    flightReasonOperator: source.flightReasonOperator,
    seatType: source.seatType,
    seatTypeOperator: source.seatTypeOperator,
    seatNumber: source.seatNumber,
    seatNumberOperator: source.seatNumberOperator,
    months: source.months,
    monthsOperator: source.monthsOperator,
    days: source.days,
    daysOperator: source.daysOperator,
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

/*
 * One boolean per location dimension with values selected. Inactive
 * dimensions contribute nothing, so the combination logic can skip them.
 */
function locationFilterResults(
  flight: FlightData,
  locationFilters: LocationFilters,
): boolean[] {
  const results: boolean[] = [];
  const fromId = flight.from?.id.toString();
  const toId = flight.to?.id.toString();

  if (locationFilters.departureAirports.length) {
    results.push(
      optionMatches(
        fromId,
        locationFilters.departureAirports,
        locationFilters.departureAirportsOperator,
      ),
    );
  }

  if (locationFilters.arrivalAirports.length) {
    results.push(
      optionMatches(
        toId,
        locationFilters.arrivalAirports,
        locationFilters.arrivalAirportsOperator,
      ),
    );
  }

  if (locationFilters.airportsEither.length) {
    results.push(
      !!fromId &&
        !!toId &&
        [fromId, toId].some((id) =>
          locationFilters.airportsEither.includes(id),
        ),
    );
  }

  if (locationFilters.routes.length) {
    const flightRoute =
      fromId && toId ? routeKey(normalizeRoute(fromId, toId)) : undefined;
    results.push(
      optionMatches(
        flightRoute,
        locationFilters.routes.map(routeKey),
        locationFilters.routesOperator ?? 'is any of',
      ),
    );
  }

  if (locationFilters.departureCountries.length) {
    results.push(
      optionMatches(
        flight.from?.country,
        locationFilters.departureCountries,
        locationFilters.departureCountriesOperator,
      ),
    );
  }

  if (locationFilters.arrivalCountries.length) {
    results.push(
      optionMatches(
        flight.to?.country,
        locationFilters.arrivalCountries,
        locationFilters.arrivalCountriesOperator,
      ),
    );
  }

  if (locationFilters.departureContinents.length) {
    results.push(
      optionMatches(
        flight.from?.continent,
        locationFilters.departureContinents,
        locationFilters.departureContinentsOperator,
      ),
    );
  }

  if (locationFilters.arrivalContinents.length) {
    results.push(
      optionMatches(
        flight.to?.continent,
        locationFilters.arrivalContinents,
        locationFilters.arrivalContinentsOperator,
      ),
    );
  }

  return results;
}

export function matchesLocationFilters(
  flight: FlightData,
  locationFilters: LocationFilters,
) {
  return combineFilterResults(locationFilterResults(flight, locationFilters));
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

export type SeatFilterContext = {
  /* Passenger tokens from an inclusive passengers filter. */
  passengerTokens?: string[];
  /* The user whose passenger row seat filters consult (mine/user scope). */
  seatUserId?: string;
};

const INCLUSIVE_PASSENGER_OPERATORS: readonly MultiOptionFilterOperator[] = [
  'include',
  'include any of',
  'include all of',
  'include exactly',
];

/*
 * Seat-related filters apply to relevant passenger rows only: the rows picked
 * by an inclusive passengers filter when set, otherwise the current scope's
 * row, otherwise any passenger row. Exclusive passengers operators fall
 * through on purpose — the flight matched because those people are not on it,
 * so scoping seat filters to them would always come up empty.
 */
export function seatFilterContext(
  filters: FlightFilters,
  seatUserId?: string,
): SeatFilterContext {
  if (
    filters.passengers.length &&
    INCLUSIVE_PASSENGER_OPERATORS.includes(filters.passengersOperator)
  ) {
    return { passengerTokens: filters.passengers };
  }
  return seatUserId ? { seatUserId } : {};
}

function seatContextPassengers(
  flight: FlightData,
  ctx?: SeatFilterContext,
): FlightPassenger[] {
  if (ctx?.passengerTokens?.length) {
    const tokens = new Set(ctx.passengerTokens);
    return flight.passengers.filter((passenger) => {
      const token = getFlightPassengerToken(passenger);
      return token != null && tokens.has(token);
    });
  }
  if (ctx?.seatUserId) {
    return flight.passengers.filter(
      (passenger) => passenger.userId === ctx.seatUserId,
    );
  }
  return flight.passengers;
}

function passengerFieldMatches(
  passengers: FlightPassenger[],
  field: 'seat' | 'seatClass' | 'flightReason' | 'seatNumber',
  selectedValues: string[],
  operator: OptionFilterOperator = 'is any of',
) {
  if (!selectedValues.length) return true;
  const found = passengers.some(
    (passenger) =>
      passenger[field] != null && selectedValues.includes(passenger[field]!),
  );
  return operator === 'is' || operator === 'is any of' ? found : !found;
}

export function flightTypeForFlight(flight: FlightData): string | undefined {
  if (!flight.from || !flight.to) return undefined;
  return flight.from.country === flight.to.country
    ? 'domestic'
    : 'international';
}

/*
 * One boolean per non-location dimension with values selected. The two date
 * bounds form a single date-range dimension.
 */
function nonLocationFilterResults(
  flight: FlightData,
  filters: FlightFilters,
  seatCtx?: SeatFilterContext,
): boolean[] {
  const results: boolean[] = [];

  if (filters.years.length) {
    results.push(
      optionMatches(
        flight.date?.getFullYear().toString(),
        filters.years,
        filters.yearsOperator,
      ),
    );
  }

  if (filters.fromDate || filters.toDate) {
    let matches = true;
    if (
      filters.fromDate &&
      (!flight.dateEnd ||
        isBefore(
          flight.dateEnd,
          getFilterBoundary(filters.fromDate, flight.dateEnd.timeZone ?? 'UTC'),
        ))
    ) {
      matches = false;
    }
    if (
      matches &&
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
      matches = false;
    }
    results.push(matches);
  }

  if (filters.passengers.length) {
    results.push(
      multiOptionMatches(
        flight.passengers
          .map((passenger) => getFlightPassengerToken(passenger))
          .filter((token): token is string => !!token),
        filters.passengers,
        filters.passengersOperator,
      ),
    );
  }

  if (filters.airline.length) {
    results.push(
      optionMatches(
        flight.airline?.name,
        filters.airline,
        filters.airlineOperator,
      ),
    );
  }

  if (filters.aircraft.length) {
    results.push(
      optionMatches(
        flight.aircraft?.name,
        filters.aircraft,
        filters.aircraftOperator,
      ),
    );
  }

  if (filters.aircraftRegs.length) {
    results.push(
      optionMatches(
        flight.aircraftReg,
        filters.aircraftRegs,
        filters.aircraftRegsOperator,
      ),
    );
  }

  if (filters.flightType.length) {
    results.push(
      optionMatches(
        flightTypeForFlight(flight),
        filters.flightType,
        filters.flightTypeOperator,
      ),
    );
  }

  if (filters.flightNumber.length) {
    results.push(
      optionMatches(
        flight.flightNumber,
        filters.flightNumber,
        filters.flightNumberOperator,
      ),
    );
  }

  if (filters.months.length) {
    results.push(
      optionMatches(
        flight.date ? String(flight.date.getMonth()) : undefined,
        filters.months,
        filters.monthsOperator,
      ),
    );
  }

  if (filters.days.length) {
    results.push(
      optionMatches(
        flight.date ? String(flight.date.getDate()) : undefined,
        filters.days,
        filters.daysOperator,
      ),
    );
  }

  const noteQuery = filters.noteQuery.trim().toLowerCase();
  if (noteQuery) {
    results.push((flight.note ?? '').toLowerCase().includes(noteQuery));
  }

  if (filters.duration.length) {
    results.push(
      optionMatches(
        durationBucketFor(flight.distance),
        filters.duration,
        filters.durationOperator,
      ),
    );
  }

  const seatPassengers = seatContextPassengers(flight, seatCtx);
  if (filters.seatClass.length) {
    results.push(
      passengerFieldMatches(
        seatPassengers,
        'seatClass',
        filters.seatClass,
        filters.seatClassOperator,
      ),
    );
  }

  if (filters.flightReason.length) {
    results.push(
      passengerFieldMatches(
        seatPassengers,
        'flightReason',
        filters.flightReason,
        filters.flightReasonOperator,
      ),
    );
  }

  if (filters.seatType.length) {
    results.push(
      passengerFieldMatches(
        seatPassengers,
        'seat',
        filters.seatType,
        filters.seatTypeOperator,
      ),
    );
  }

  if (filters.seatNumber.length) {
    results.push(
      passengerFieldMatches(
        seatPassengers,
        'seatNumber',
        filters.seatNumber,
        filters.seatNumberOperator,
      ),
    );
  }

  return results;
}

export function matchesNonLocationFilters(
  flight: FlightData,
  filters: FlightFilters,
  seatCtx?: SeatFilterContext,
) {
  return combineFilterResults(
    nonLocationFilterResults(flight, filters, seatCtx),
  );
}

export function matchesFlight(
  flight: FlightData,
  filters: FlightFilters,
  seatCtx?: SeatFilterContext,
) {
  return combineFilterResults(
    [
      ...locationFilterResults(flight, filters),
      ...nonLocationFilterResults(flight, filters, seatCtx),
    ],
    filters.logic,
  );
}
