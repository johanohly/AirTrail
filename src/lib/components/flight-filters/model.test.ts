import { CalendarDate } from '@internationalized/date';
import { describe, expect, it, vi } from 'vitest';

import {
  cycleOptionValue,
  optionValueState,
  isFilterColumnActive,
  cloneFlightFilters,
  createDefaultFilters,
  perYearFilters,
  selectedFilterYears,
  toggleFilterYear,
  flightReasonFilterOptions,
  flightReasonForUser,
  matchesFlight,
  setOptionColumnValues,
  setOptionColumnOperator,
  clearFilterColumn,
  hasFlightFilters,
  flightFiltersToBits,
  bitsFiltersToFlightFilters,
  flightSignature,
} from './model';
import type { FlightData } from '$lib/utils';

vi.mock('$app/state', () => ({ page: { data: { user: { id: 'me' } } } }));

const filters = (next = {}) => cloneFlightFilters(createDefaultFilters(), next);

describe('flight reason filter', () => {
  const flight = (reason: string | null, otherReason = 'crew') =>
    ({
      passengers: [
        { userId: 'me', flightReason: reason },
        { userId: 'other', flightReason: otherReason },
      ],
    }) as FlightData;

  it('offers only deduplicated reasons saved for the current user, including custom and removed labels', () => {
    const flights = [
      flight('business'),
      flight('business'),
      flight('Family Visit'),
      flight('Retired reason'),
      flight(null),
      flight(''),
      flight('  '),
      {
        passengers: [{ userId: 'other', flightReason: 'Other user only' }],
      } as unknown as FlightData,
    ];
    expect(flightReasonFilterOptions(flights, 'me')).toEqual([
      { value: 'business', label: 'Business', count: 2 },
      { value: 'Family Visit', label: 'Family Visit', count: 1 },
      { value: 'Retired reason', label: 'Retired reason', count: 1 },
    ]);
    expect(flightReasonFilterOptions(flights, null)).toEqual([]);
    expect(flightReasonForUser(flights[7]!, 'me')).toBeNull();
  });

  it('matches any selected reason for the current user and supports exclusion', () => {
    const selected = setOptionColumnValues(filters(), 'reasons', [
      'business',
      'Family Visit',
    ]);
    expect(selected.reasonsOperator).toBe('is any of');
    expect(matchesFlight(flight('business'), selected, 'me')).toBe(true);
    expect(matchesFlight(flight('business'), selected)).toBe(true);
    expect(matchesFlight(flight('Family Visit'), selected, 'me')).toBe(true);
    expect(matchesFlight(flight('leisure', 'business'), selected, 'me')).toBe(
      false,
    );
    expect(matchesFlight(flight(null), selected, 'me')).toBe(false);
    expect(matchesFlight(flight('business'), selected, null)).toBe(false);
    const excluded = setOptionColumnOperator(selected, 'reasons', 'is none of');
    expect(matchesFlight(flight('business'), excluded, 'me')).toBe(false);
    expect(matchesFlight(flight('leisure'), excluded, 'me')).toBe(true);
    expect(matchesFlight(flight(null), excluded, 'me')).toBe(true);
    expect(matchesFlight(flight(null), filters(), 'me')).toBe(true);
  });

  it('round trips selections, clones independently, and clears the active filter', () => {
    const selected = setOptionColumnValues(filters(), 'reasons', [
      'business',
      'Family Visit',
    ]);
    const restored = bitsFiltersToFlightFilters(flightFiltersToBits(selected));
    expect(restored).toEqual(selected);
    expect(hasFlightFilters(restored)).toBe(true);
    expect(flightSignature(restored)).not.toBe(flightSignature(filters()));
    const cloned = cloneFlightFilters(restored);
    cloned.reasons.push('Other');
    expect(restored.reasons).toEqual(['business', 'Family Visit']);
    const cleared = clearFilterColumn(restored, 'reasons');
    expect(hasFlightFilters(cleared)).toBe(false);
    expect(bitsFiltersToFlightFilters([], restored).reasons).toEqual([]);
    expect(
      setOptionColumnValues(selected, 'reasons', ['business']).reasonsOperator,
    ).toBe('is');
  });
});

describe('year filter', () => {
  it('selects a year and replaces any other date filter', () => {
    const next = toggleFilterYear(
      filters({
        fromDate: new CalendarDate(2024, 3, 1),
        toDate: new CalendarDate(2024, 4, 1),
      }),
      '2025',
    );
    expect(next.years).toEqual(['2025']);
    expect(next.yearsOperator).toBe('is');
    expect(next.fromDate).toBeUndefined();
    expect(next.toDate).toBeUndefined();
  });

  it('clears the filter when the selected year is picked again', () => {
    const next = toggleFilterYear(
      filters({ years: ['2025'], yearsOperator: 'is' }),
      '2025',
    );
    expect(next.years).toEqual([]);
  });

  it('narrows several selected years down to the picked one', () => {
    const next = toggleFilterYear(filters({ years: ['2024', '2025'] }), '2025');
    expect(next.years).toEqual(['2025']);
  });

  it('keeps other filters', () => {
    const next = toggleFilterYear(filters({ airline: ['1'] }), '2025');
    expect(next.airline).toEqual(['1']);
  });

  it('reads a full year range as that year', () => {
    expect(
      selectedFilterYears(
        filters({
          fromDate: new CalendarDate(2025, 1, 1),
          toDate: new CalendarDate(2025, 12, 31),
        }),
      ),
    ).toEqual(['2025']);
  });

  it('does not read an excluded year or a custom range as selected', () => {
    expect(
      selectedFilterYears(
        filters({ years: ['2025'], yearsOperator: 'is not' }),
      ),
    ).toEqual([]);
    expect(
      selectedFilterYears(
        filters({
          fromDate: new CalendarDate(2025, 2, 1),
          toDate: new CalendarDate(2025, 3, 1),
        }),
      ),
    ).toEqual([]);
  });

  it('counts per year without a year filter but with a custom range', () => {
    expect(perYearFilters(filters({ years: ['2025'] })).years).toEqual([]);
    const fromDate = new CalendarDate(2025, 2, 1);
    expect(perYearFilters(filters({ fromDate })).fromDate).toEqual(fromDate);
  });
});

describe('three-state option filters', () => {
  it('cycles a full-year date selection without leaving a conflicting date range', () => {
    const initial = filters({
      fromDate: new CalendarDate(2026, 1, 1),
      toDate: new CalendarDate(2026, 12, 31),
    });
    expect(optionValueState(initial, 'years', '2026')).toBe('include');
    const excluded = cycleOptionValue(initial, 'years', '2026');
    expect(optionValueState(excluded, 'years', '2026')).toBe('exclude');
    expect(excluded.fromDate).toBeUndefined();
    expect(excluded.toDate).toBeUndefined();
    const expanded = cycleOptionValue(initial, 'years', '2025');
    expect(expanded.years).toEqual(['2026', '2025']);
  });
  const flight = (airline?: string, passengers: string[] = [], year = 2026) =>
    ({
      airline: airline ? { name: airline } : null,
      passengers: passengers.map((userId) => ({
        userId,
        user: { id: userId, username: userId },
      })),
      date: new Date(year, 0, 1),
      from: { id: 1 },
      to: { id: 2 },
    }) as unknown as FlightData;

  it('cycles without mutating the original and clears exclusion-only filters', () => {
    const original = filters();
    const include = cycleOptionValue(original, 'airline', 'Cathay');
    const exclude = cycleOptionValue(include, 'airline', 'Cathay');
    const cleared = cycleOptionValue(exclude, 'airline', 'Cathay');
    expect(optionValueState(original, 'airline', 'Cathay')).toBe('unselected');
    expect(optionValueState(include, 'airline', 'Cathay')).toBe('include');
    expect(optionValueState(exclude, 'airline', 'Cathay')).toBe('exclude');
    expect(hasFlightFilters(exclude)).toBe(true);
    expect(isFilterColumnActive(exclude, 'airline')).toBe(true);
    expect(hasFlightFilters(cleared)).toBe(false);
    expect(matchesFlight(flight('Cathay'), exclude)).toBe(false);
    expect(matchesFlight(flight('HK Express'), exclude)).toBe(true);
    expect(matchesFlight(flight(), exclude)).toBe(true);
    expect(hasFlightFilters(clearFilterColumn(exclude, 'airline'))).toBe(false);
  });

  it('combines any included airline with exclusions and ANDs different categories', () => {
    let selected = cycleOptionValue(filters(), 'airline', 'Cathay');
    selected = cycleOptionValue(selected, 'airline', 'HK Express');
    selected = cycleOptionValue(
      cycleOptionValue(selected, 'airline', 'AirAsia'),
      'airline',
      'AirAsia',
    );
    selected = cycleOptionValue(selected, 'years', '2026');
    expect(matchesFlight(flight('Cathay'), selected)).toBe(true);
    expect(matchesFlight(flight('HK Express'), selected)).toBe(true);
    expect(matchesFlight(flight('AirAsia'), selected)).toBe(false);
    expect(matchesFlight(flight('Cathay', [], 2025), selected)).toBe(false);
    expect(matchesFlight(flight(), selected)).toBe(false);
    expect(bitsFiltersToFlightFilters(flightFiltersToBits(selected))).toEqual(
      selected,
    );
    const clone = cloneFlightFilters(selected);
    clone.excludedValues!.airline!.push('Other');
    expect(selected.excludedValues!.airline).toEqual(['AirAsia']);
  });

  it('excludes a flight containing a blocked passenger even with an included passenger', () => {
    let selected = cycleOptionValue(filters(), 'passengers', 'user:me');
    selected = cycleOptionValue(
      cycleOptionValue(selected, 'passengers', 'user:other'),
      'passengers',
      'user:other',
    );
    expect(matchesFlight(flight('Cathay', ['me']), selected)).toBe(true);
    expect(matchesFlight(flight('Cathay', ['me', 'other']), selected)).toBe(
      false,
    );
    expect(matchesFlight(flight('Cathay', ['someone']), selected)).toBe(false);
  });

  it('preserves legacy exclusions when cycling another value', () => {
    const legacy = filters({ airline: ['Cathay'], airlineOperator: 'is not' });
    expect(optionValueState(legacy, 'airline', 'Cathay')).toBe('exclude');
    const next = cycleOptionValue(legacy, 'airline', 'HK Express');
    expect(optionValueState(next, 'airline', 'Cathay')).toBe('exclude');
    expect(matchesFlight(flight('Cathay'), next)).toBe(false);
    expect(matchesFlight(flight('HK Express'), next)).toBe(true);
  });

  it('applies airport and year exclusions, and clears year exclusions with the date filter', () => {
    let selected = cycleOptionValue(
      cycleOptionValue(filters(), 'departureAirports', '1'),
      'departureAirports',
      '1',
    );
    expect(matchesFlight(flight('Cathay'), selected)).toBe(false);
    selected = clearFilterColumn(selected, 'departureAirports');
    selected = cycleOptionValue(
      cycleOptionValue(selected, 'years', '2026'),
      'years',
      '2026',
    );
    expect(matchesFlight(flight('Cathay'), selected)).toBe(false);
    expect(matchesFlight(flight('Cathay', [], 2025), selected)).toBe(true);
    expect(
      matchesFlight(flight('Cathay'), clearFilterColumn(selected, 'date')),
    ).toBe(true);
  });
});
