import { describe, it, expect } from 'vitest';
import { mergeTimeWithDate } from './parse';
import { TZDate } from '@date-fns/tz';

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
