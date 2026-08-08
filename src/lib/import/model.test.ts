import { describe, expect, it } from 'vitest';

import {
  createEmptyImportMappings,
  getOutstandingUnknowns,
  getPendingFlights,
  mergeImportMappings,
} from './model';

import type { Aircraft, CreateFlight } from '$lib/db/types';

const flight = (date: string) => ({ date }) as CreateFlight;

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

  it('does not replay handled rows after another mapping resolves', () => {
    const flights = [
      flight('2026-01-01'),
      flight('2026-01-02'),
      flight('2026-01-03'),
    ];

    const pending = getPendingFlights(
      flights,
      {
        airports: {},
        airlines: {},
        aircraft: { B: [1] },
      },
      new Set([0]),
    );

    expect(pending.map(({ index }) => index)).toEqual([2]);
  });

  it('allows unknown optional references while still blocking unknown airports', () => {
    const flights = [
      flight('2026-01-01'),
      flight('2026-01-02'),
      flight('2026-01-03'),
    ];

    const pending = getPendingFlights(
      flights,
      {
        airports: { CPH: [0] },
        airlines: { NWA: [1] },
        aircraft: { B733: [2] },
      },
      new Set(),
      {
        allowUnknownAirlines: true,
        allowUnknownAircraft: true,
      },
    );

    expect(pending.map(({ index }) => index)).toEqual([1, 2]);
  });

  it('removes unknown values after their flights are handled', () => {
    const outstanding = getOutstandingUnknowns(
      {
        airports: { CPH: [0] },
        airlines: { NWA: [1, 2], JAI: [2] },
        aircraft: {},
      },
      new Set([1, 2]),
    );

    expect(outstanding).toEqual({
      airports: { CPH: [0] },
      airlines: {},
      aircraft: {},
    });
  });
});
