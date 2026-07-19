import { describe, expect, it } from 'vitest';

import { createEmptyImportMappings, mergeImportMappings } from './model';

import type { Aircraft } from '$lib/db/types';

describe('import mapping model', () => {
  it('merges entity mappings without discarding earlier choices', () => {
    const firstAircraft = { id: 1 } as Aircraft;
    const secondAircraft = { id: 2 } as Aircraft;
    const current = createEmptyImportMappings();
    current.aircraft.A = firstAircraft;

    const pending = createEmptyImportMappings();
    pending.aircraft.B = secondAircraft;

    expect(mergeImportMappings(current, pending).aircraft).toEqual({
      A: firstAircraft,
      B: secondAircraft,
    });
  });
});
