import { CalendarDate } from '@internationalized/date';
import { describe, expect, it, vi } from 'vitest';

import {
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
