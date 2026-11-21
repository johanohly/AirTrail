import { describe, expect, it } from 'vitest';

import { getLookupDate } from './lookup-date';

const nov14 = '2026-11-14T00:00:00.000Z';
const nov15 = '2026-11-15T00:00:00.000Z';
const nov20 = '2026-11-20T00:00:00.000Z';

describe('getLookupDate', () => {
  it('prefers the scheduled departure date', () => {
    // Scheduled 23:35 on Nov 14, delayed past midnight to Nov 15.
    expect(
      getLookupDate({ departure: nov15, departureScheduled: nov14 }),
    ).toEqual({ date: nov14, dateKind: 'scheduled' });
  });

  it('falls back to the departure date as an actual date', () => {
    expect(
      getLookupDate({ departure: nov15, departureScheduled: null }),
    ).toEqual({ date: nov15, dateKind: 'actual' });
  });

  it('uses the scheduled date when there is no departure date', () => {
    expect(
      getLookupDate({ departure: null, departureScheduled: nov14 }),
    ).toEqual({ date: nov14, dateKind: 'scheduled' });
  });

  it('ignores a scheduled date left over from another day', () => {
    // The user moved the departure after an earlier lookup set Nov 14.
    expect(
      getLookupDate({ departure: nov20, departureScheduled: nov14 }),
    ).toEqual({ date: nov20, dateKind: 'actual' });
  });

  it('returns null without either date', () => {
    expect(getLookupDate({ departure: null, departureScheduled: null })).toBe(
      null,
    );
  });
});
