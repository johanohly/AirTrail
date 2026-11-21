import { describe, expect, it } from 'vitest';

import { getLookupDate } from './lookup-date';

import { decomposeToLocal } from '$lib/utils/datetime/parse';

const nov14 = '2026-11-14T00:00:00.000Z';
const nov15 = '2026-11-15T00:00:00.000Z';
const nov16 = '2026-11-16T00:00:00.000Z';

describe('getLookupDate', () => {
  it('looks up a flight delayed past midnight by its scheduled date', () => {
    // CI22 from Taipei: scheduled 23:35 on Nov 14, left at 00:22 on Nov 15.
    // The edit form fills its dates like this from the stored flight.
    const departure = decomposeToLocal(
      '2026-11-14T16:22:00.000Z',
      'Asia/Taipei',
      'en-US',
    ).date;
    const departureScheduled = decomposeToLocal(
      '2026-11-14T15:35:00.000Z',
      'Asia/Taipei',
      'en-US',
    ).date;

    expect(departure).toBe(nov15);
    expect(getLookupDate({ departure, departureScheduled })).toBe(nov14);
  });

  it('falls back to the departure date', () => {
    expect(getLookupDate({ departure: nov15, departureScheduled: null })).toBe(
      nov15,
    );
  });

  it('uses the scheduled date when there is no departure date', () => {
    expect(getLookupDate({ departure: null, departureScheduled: nov14 })).toBe(
      nov14,
    );
  });

  it('ignores a scheduled date that does not match the departure', () => {
    // The user moved the departure after an earlier lookup set Nov 14.
    expect(getLookupDate({ departure: nov16, departureScheduled: nov14 })).toBe(
      nov16,
    );
  });

  it('returns null without either date', () => {
    expect(getLookupDate({ departure: null, departureScheduled: null })).toBe(
      null,
    );
  });
});
