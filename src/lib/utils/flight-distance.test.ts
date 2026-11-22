import { describe, expect, it } from 'vitest';

import { isSameAirportRoute, resolveFlightDistance } from './flight-distance';

const CPH = { lat: 55.618, lon: 12.656 };
const ARN = { lat: 59.652, lon: 17.919 };
/** Great-circle distance between CPH and ARN, in km. */
const CPH_ARN_KM = 547;

const flight = (
  overrides: Partial<Parameters<typeof resolveFlightDistance>[0]> = {},
) => ({
  from: CPH,
  to: ARN,
  manualDistance: null,
  trackDistance: null,
  ...overrides,
});

describe('resolveFlightDistance', () => {
  it('falls back to the great-circle distance', () => {
    const distance = resolveFlightDistance(flight());

    expect(distance?.source).toBe('great-circle');
    expect(distance?.km).toBeCloseTo(CPH_ARN_KM, -1);
  });

  it('uses a plausible track distance', () => {
    expect(resolveFlightDistance(flight({ trackDistance: 646 }))).toEqual({
      km: 646,
      source: 'track',
    });
  });

  it('prefers a manual distance over the track', () => {
    expect(
      resolveFlightDistance(
        flight({ manualDistance: 600, trackDistance: 646 }),
      ),
    ).toEqual({ km: 600, source: 'manual' });
  });

  it.each([
    ['far longer than the route', 2_000],
    ['missing its start or end', 300],
  ])('ignores a track %s', (_, trackDistance) => {
    expect(resolveFlightDistance(flight({ trackDistance }))?.source).toBe(
      'great-circle',
    );
  });

  it.each([106, 6_000])(
    'uses a %s km track of a flight back to the same airport',
    (trackDistance) => {
      expect(resolveFlightDistance(flight({ to: CPH, trackDistance }))).toEqual(
        { km: trackDistance, source: 'track' },
      );
    },
  );

  it('uses a manual distance on a flight back to the same airport', () => {
    expect(
      resolveFlightDistance(flight({ to: CPH, manualDistance: 106 })),
    ).toEqual({ km: 106, source: 'manual' });
  });

  it('has no distance without airports or a manual value', () => {
    expect(resolveFlightDistance(flight({ from: null }))).toBeNull();
    expect(
      resolveFlightDistance(flight({ from: null, manualDistance: 80 })),
    ).toEqual({ km: 80, source: 'manual' });
  });

  it('treats fields a partial flight leaves out as missing', () => {
    const partial = { from: CPH, to: ARN } as Parameters<
      typeof resolveFlightDistance
    >[0];

    expect(resolveFlightDistance(partial)?.source).toBe('great-circle');
  });
});

describe('isSameAirportRoute', () => {
  it('spots a flight back to its own airport', () => {
    expect(isSameAirportRoute(CPH, CPH)).toBe(true);
  });

  it('rejects a flight between two airports', () => {
    expect(isSameAirportRoute(CPH, ARN)).toBe(false);
  });

  it('needs both airports', () => {
    expect(isSameAirportRoute(CPH, null)).toBe(false);
  });
});
