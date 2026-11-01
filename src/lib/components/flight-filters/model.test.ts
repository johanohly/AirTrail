import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  cloneFlightFilters,
  createDefaultFilters,
  perYearFilters,
  selectedFilterYears,
  toggleFilterYear,
} from './model';

const filters = (next = {}) => cloneFlightFilters(createDefaultFilters(), next);

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
