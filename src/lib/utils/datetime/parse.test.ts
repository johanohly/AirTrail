import { TZDate } from '@date-fns/tz';
import { describe, it, expect } from 'vitest';

import { decomposeToLocal, mergeTimeWithDate } from './parse';

describe('mergeTimeWithDate', () => {
  it('should merge date and time correctly for 24-hour format', () => {
    const result = mergeTimeWithDate('2023-10-10', '9:30', 'America/New_York');
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it('should merge date and time correctly at 00:30', () => {
    const result = mergeTimeWithDate('2023-10-10', '00:30', 'America/New_York');
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(30);
  });

  it('should merge date and time correctly for AM time', () => {
    const result = mergeTimeWithDate(
      '2023-10-10',
      '10:30 am',
      'America/New_York',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });

  it('should merge date and time correctly for PM time', () => {
    const result = mergeTimeWithDate(
      '2023-10-10',
      '2:45 pm',
      'America/New_York',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it('should merge date and time correctly for 12 AM', () => {
    const result = mergeTimeWithDate(
      '2023-10-10',
      '12:00 am',
      'America/New_York',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('should merge date and time correctly for 12 PM', () => {
    const result = mergeTimeWithDate(
      '2023-10-10',
      '12:00 pm',
      'America/New_York',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth() + 1).toBe(10);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it('should merge date and time correctly for 18:59 in New York', () => {
    const result = mergeTimeWithDate(
      '2024-11-09T00:00:00.000Z',
      '18:59',
      'America/New_York',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth() + 1).toBe(11);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(18);
    expect(result.getMinutes()).toBe(59);
  });

  it('should not shift months for Asia/Amman dates', () => {
    // Regression: date-fns parse with tz() can shift some Asia/Amman
    // dates (e.g. 2016-04-30) into March, making arrivals appear
    // earlier than departures in UTC.
    const result = mergeTimeWithDate(
      '2016-04-30T00:00:00.000Z',
      '2:00 am',
      'Asia/Amman',
    );
    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2016);
    expect(result.getMonth() + 1).toBe(4);
    expect(result.getDate()).toBe(30);
    expect(result.getHours()).toBe(2);
    expect(result.getMinutes()).toBe(0);
  });

  it('should throw an error for invalid date format', () => {
    expect(() =>
      mergeTimeWithDate('10-10-2023', '10:30', 'America/New_York'),
    ).toThrow('Invalid ISO 8601 date time string: 10-10-2023');
  });

  it('should throw an error for invalid time format', () => {
    expect(() =>
      mergeTimeWithDate('2023-10-10', '25:00', 'America/New_York'),
    ).toThrow('Invalid format');
  });

  it('should throw an error for missing time parts', () => {
    expect(() =>
      mergeTimeWithDate('2023-10-10', '10:', 'America/New_York'),
    ).toThrow('Invalid format');
  });
});

describe('decomposeToLocal', () => {
  it('should return nulls for null iso', () => {
    expect(decomposeToLocal(null, 'America/New_York', 'en-US')).toEqual({
      date: null,
      time: null,
    });
  });

  it('should strip time and return UTC-midnight anchor when no timezone', () => {
    const result = decomposeToLocal('2025-03-15T18:30:00.000Z', null, 'en-US');
    expect(result.date).toBe('2025-03-15T00:00:00.000Z');
    expect(result.time).toBeNull();
  });

  it('should correct date shift for positive-offset timezone', () => {
    // Tokyo is UTC+9. A flight departing 2025-01-15 02:00 JST is stored as
    // 2025-01-14T17:00:00Z.  The day picker must show Jan 15, not Jan 14.
    const result = decomposeToLocal(
      '2025-01-14T17:00:00.000Z',
      'Asia/Tokyo',
      'fr-FR',
    );
    expect(result.date).toBe('2025-01-15T00:00:00.000Z');
    expect(result.time).toBe('02:00');
  });

  it('should keep same date for negative-offset timezone when no day shift', () => {
    // New York is UTC-4 (EDT). 2025-07-04T22:30Z = 2025-07-04 18:30 local.
    const result = decomposeToLocal(
      '2025-07-04T22:30:00.000Z',
      'America/New_York',
      'en-US',
    );
    expect(result.date).toBe('2025-07-04T00:00:00.000Z');
    expect(result.time).toBe('6:30 PM');
  });

  it('should correct date shift for negative-offset timezone', () => {
    // New York is UTC-5 (EST). 2025-01-01T03:00Z = 2024-12-31 22:00 local.
    // The day picker must show Dec 31, not Jan 1.
    const result = decomposeToLocal(
      '2025-01-01T03:00:00.000Z',
      'America/New_York',
      'en-US',
    );
    expect(result.date).toBe('2024-12-31T00:00:00.000Z');
    expect(result.time).toBe('10:00 PM');
  });

  it('should format time in 24-hour for fr-FR locale', () => {
    const result = decomposeToLocal(
      '2025-06-15T14:45:00.000Z',
      'Europe/Paris',
      'fr-FR',
    );
    // Paris is UTC+2 in summer, so 14:45Z = 16:45 local
    expect(result.date).toBe('2025-06-15T00:00:00.000Z');
    expect(result.time).toBe('16:45');
  });

  it('should round-trip with mergeTimeWithDate', () => {
    // Verify the decomposed values can be reassembled by mergeTimeWithDate
    // back to the original UTC instant.
    const originalUtc = '2025-03-20T23:15:00.000Z';
    const tzId = 'Asia/Tokyo';
    const { date, time } = decomposeToLocal(originalUtc, tzId, 'fr-FR');

    expect(date).not.toBeNull();
    expect(time).not.toBeNull();

    const reassembled = mergeTimeWithDate(date!, time!, tzId);
    // Convert back to UTC for comparison
    const reassembledUtc = new TZDate(reassembled, 'UTC');
    // TZDate uses +00:00 instead of Z, so compare via getTime()
    expect(reassembledUtc.getTime()).toBe(new Date(originalUtc).getTime());
  });
});
