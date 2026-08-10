import { describe, expect, it } from 'vitest';

import { findAutomaticTrackCandidate } from './candidates';
import type { ParsedTrackCandidate } from './parser';

const candidate = (
  legIndex: number,
  startCoordinate: [number, number],
  endCoordinate: [number, number],
  startTime: number,
): ParsedTrackCandidate => ({
  legIndex,
  startCoordinate,
  endCoordinate,
  startTime,
  endTime: startTime + 3_600,
  track: {
    coordinates: [startCoordinate, endCoordinate],
    sourceFormat: 'readsb',
    sourceName: `trace.json (leg ${legIndex})`,
    originalPointCount: 2,
  },
});

describe('flight track candidate matching', () => {
  const copenhagen = { lat: 55.618, lon: 12.656 };
  const gatwick = { lat: 51.1537, lon: -0.1821 };
  const geneva = { lat: 46.2381, lon: 6.1089 };

  it('matches the only leg with the selected airport endpoints', () => {
    const candidates = [
      candidate(1, [12.656, 55.618], [-0.1821, 51.1537], 1_000),
      candidate(2, [-0.1821, 51.1537], [12.656, 55.618], 5_000),
      candidate(3, [12.656, 55.618], [6.1089, 46.2381], 9_000),
    ];

    expect(
      findAutomaticTrackCandidate(candidates, {
        from: copenhagen,
        to: geneva,
      })?.legIndex,
    ).toBe(3);
  });

  it('leaves repeated route matches for explicit selection', () => {
    const candidates = [
      candidate(1, [12.656, 55.618], [-0.1821, 51.1537], 1_000),
      candidate(2, [12.656, 55.618], [-0.1821, 51.1537], 10_000),
    ];

    expect(
      findAutomaticTrackCandidate(candidates, {
        from: copenhagen,
        to: gatwick,
      }),
    ).toBeNull();
  });
});
