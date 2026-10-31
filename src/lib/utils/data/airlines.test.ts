import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAirlineLookupCaches, getAirlineByCodes } from './airlines';

const airline = (
  id: number,
  name: string,
  icao: string,
  iata: string | null,
) => ({
  id,
  name,
  icao,
  iata,
  sourceId: null,
  iconPath: null,
});

const AIR_BERLIN = airline(1, 'Air Berlin', 'BER', 'AB');
const FLY_AIR41 = airline(2, 'Fly Air41', 'BER', null);
const INSELFLIEGER = airline(3, 'Inselflieger', 'LFH', null);

const { airlines } = vi.hoisted(() => ({
  airlines: [] as ReturnType<typeof airline>[],
}));

vi.mock('$lib/trpc', () => ({
  api: {
    airline: {
      getByIcao: {
        query: async (icao: string) =>
          airlines.find((a) => a.icao === icao.toUpperCase()) ?? null,
      },
      getByIata: {
        query: async (iata: string) =>
          airlines.find((a) => a.iata === iata.toUpperCase()) ?? null,
      },
    },
  },
}));

describe('getAirlineByCodes', () => {
  beforeEach(() => {
    clearAirlineLookupCaches();
    airlines.length = 0;
  });

  it('rejects an airline that reused the ICAO code of a defunct one', async () => {
    airlines.push(FLY_AIR41);

    expect(await getAirlineByCodes('BER', 'AB', 'Air Berlin')).toBeNull();
  });

  it('prefers the airline whose IATA code also matches', async () => {
    airlines.push(FLY_AIR41, AIR_BERLIN);

    expect(await getAirlineByCodes('BER', 'AB', 'Air Berlin')).toEqual(
      AIR_BERLIN,
    );
  });

  it('accepts an ICAO match without an IATA code when the name matches', async () => {
    airlines.push(INSELFLIEGER);

    expect(await getAirlineByCodes('LFH', 'IF', 'Inselflieger')).toEqual(
      INSELFLIEGER,
    );
  });

  it('falls back to the ICAO code when there is no IATA code', async () => {
    airlines.push(FLY_AIR41);

    expect(await getAirlineByCodes('BER', null, 'Fly Air41')).toEqual(
      FLY_AIR41,
    );
  });
});
