import { describe, expect, it } from 'vitest';

import {
  customFlightReasonsSchema,
  flightReasonLabel,
  flightReasonOptions,
} from './flight-reasons';

describe('flight reasons', () => {
  it('lists built-ins first, then your own reasons, then Other', () => {
    expect(flightReasonOptions(['Study abroad'])).toEqual([
      'leisure',
      'business',
      'crew',
      'Study abroad',
      'other',
    ]);
  });

  it('keeps a saved reason that is no longer in the list', () => {
    expect(flightReasonOptions([], 'Removed')).toEqual([
      'leisure',
      'business',
      'crew',
      'Removed',
      'other',
    ]);
    expect(flightReasonOptions(['Removed'], 'Removed')).toHaveLength(5);
    expect(flightReasonOptions([], 'crew')).toHaveLength(4);
  });

  it('labels built-ins in title case and custom reasons as written', () => {
    expect(flightReasonLabel('crew')).toBe('Crew');
    expect(flightReasonLabel('VIP trip')).toBe('VIP trip');
  });

  it('trims reasons and rejects built-ins, blanks and duplicates', () => {
    expect(customFlightReasonsSchema.parse([' Study abroad '])).toEqual([
      'Study abroad',
    ]);
    for (const reasons of [
      ['Business'],
      ['other'],
      ['Study', 'study'],
      [' '],
      ['x'.repeat(101)],
    ]) {
      expect(customFlightReasonsSchema.safeParse(reasons).success).toBe(false);
    }
  });
});
