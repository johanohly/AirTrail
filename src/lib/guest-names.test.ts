import { describe, expect, it } from 'vitest';

import {
  canUseGuestName,
  hasDuplicateGuestNames,
  rankGuestNames,
} from './guest-names';

describe('rankGuestNames', () => {
  it('combines case and whitespace variants before ranking', () => {
    expect(
      rankGuestNames([
        { name: 'Alice', count: 2 },
        { name: ' alice ', count: 1 },
        { name: 'Bob', count: 2 },
      ]),
    ).toEqual([
      { name: 'Alice', count: 3 },
      { name: 'Bob', count: 2 },
    ]);
  });

  it('uses the most frequent spelling for display', () => {
    expect(
      rankGuestNames([
        { name: 'ALICE', count: 1 },
        { name: 'Alice', count: 3 },
      ]),
    ).toEqual([{ name: 'Alice', count: 4 }]);
  });

  it('uses a deterministic spelling when variants have equal counts', () => {
    expect(
      rankGuestNames([
        { name: 'alice', count: 1 },
        { name: 'Alice', count: 1 },
      ]),
    ).toEqual([{ name: 'Alice', count: 2 }]);
  });
});

describe('canUseGuestName', () => {
  const knownGuests = [{ name: 'Alice', count: 2 }];

  it('rejects known and excluded names after trimming and case folding', () => {
    expect(
      canUseGuestName({ name: ' alice ', knownGuests, excludedNames: [] }),
    ).toBe(false);
    expect(
      canUseGuestName({
        name: ' BOB ',
        knownGuests,
        excludedNames: ['Bob'],
      }),
    ).toBe(false);
  });

  it('accepts a new non-empty name', () => {
    expect(
      canUseGuestName({ name: 'Carol', knownGuests, excludedNames: ['Bob'] }),
    ).toBe(true);
    expect(
      canUseGuestName({ name: '   ', knownGuests, excludedNames: [] }),
    ).toBe(false);
  });
});

describe('hasDuplicateGuestNames', () => {
  it('treats case and whitespace variants as duplicates', () => {
    expect(hasDuplicateGuestNames(['Alice', ' alice '])).toBe(true);
  });

  it('ignores registered users and distinct guests', () => {
    expect(hasDuplicateGuestNames([null, 'Alice', 'Bob'])).toBe(false);
  });
});
