import { CalendarDate } from '@internationalized/date';
import { isAfter, isBefore } from 'date-fns';
import type { FilterModel, FiltersState } from 'bits-ui';

import type {
  FlightFilters,
  LocationFilters,
  MultiOptionFilterOperator,
  OptionFilterOperator,
  Route,
} from './types';

import { getSeatPassengerToken, type FlightData } from '$lib/utils';
import { parseLocalISO } from '$lib/utils/datetime';
import { formatDate } from '$lib/utils/preferences';
import type { Preferences } from '$lib/zod/user';

export type FilterColumnId =
  | 'departureAirports'
  | 'arrivalAirports'
  | 'date'
  | 'passengers'
  | 'airline'
  | 'aircraft'
  | 'aircraftRegs'
  | 'flight';

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
    airline: [],
    airlineOperator: 'is any of',
    aircraft: [],
    aircraftOperator: 'is any of',
    aircraftRegs: [],
    aircraftRegsOperator: 'is any of',
    flightIds: [],
    flightIdsOperator: 'is any of',
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
    airline: [...source.airline],
    aircraft: [...source.aircraft],
    aircraftRegs: [...source.aircraftRegs],
    flightIds: [...source.flightIds],
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
      filters.years.length > 0 ||
      filters.fromDate ||
      filters.toDate ||
      filters.passengers.length > 0 ||
      filters.airline.length > 0 ||
      filters.aircraft.length > 0 ||
      filters.aircraftRegs.length > 0 ||
      filters.flightIds.length > 0)
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
  if (columnId === 'flight') return filters.flightIds;
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
    case 'airline':
      return filters.airlineOperator;
    case 'aircraft':
      return filters.aircraftOperator;
    case 'aircraftRegs':
      return filters.aircraftRegsOperator;
    case 'flight':
      return filters.flightIdsOperator;
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
    case 'flight':
      return cloneFlightFilters(filters, {
        flightIdsOperator: operator as OptionFilterOperator,
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
    case 'flight':
      return cloneFlightFilters(filters, {
        flightIds: values,
        flightIdsOperator: operator as OptionFilterOperator,
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
    optionFilter('airline', source.airline, source.airlineOperator),
    optionFilter('aircraft', source.aircraft, source.aircraftOperator),
    optionFilter(
      'aircraftRegs',
      source.aircraftRegs,
      source.aircraftRegsOperator,
    ),
    optionFilter('flight', source.flightIds, source.flightIdsOperator),
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
    flightIds: [],
    flightIdsOperator: 'is any of',
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
      case 'flight':
        nextFilters.flightIds = stringValues(filter);
        nextFilters.flightIdsOperator = filter.operator as OptionFilterOperator;
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
    flightIds: source.flightIds,
    flightIdsOperator: source.flightIdsOperator,
  });
}

export function routeMatches(flight: FlightData, route: Route): boolean {
  const fromId = flight.from?.id.toString();
  const toId = flight.to?.id.toString();
  return (
    (fromId === route.a && toId === route.b) ||
    (fromId === route.b && toId === route.a)
  );
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
) {
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
      flight.seats
        .map((seat) => getSeatPassengerToken(seat))
        .filter((token): token is string => !!token),
      filters.passengers,
      filters.passengersOperator,
    )
  ) {
    return false;
  }

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

  if (
    !optionMatches(
      flight.id.toString(),
      filters.flightIds,
      filters.flightIdsOperator,
    )
  ) {
    return false;
  }

  return true;
}

export function matchesFlight(flight: FlightData, filters: FlightFilters) {
  return (
    matchesLocationFilters(flight, filters) &&
    matchesNonLocationFilters(flight, filters)
  );
}
