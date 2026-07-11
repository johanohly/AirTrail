import { describe, expect, it } from 'vitest';

import type { FlightArc, FlightTrackPath } from './flight-layer-data';
import {
  applyFlightTrackInteractionColor,
  getEstimatedTrackUnderlayColor,
  resolveRouteInteraction,
  type RouteInteractionContext,
} from './flight-track-interaction';

const airport = (id: number) => ({ id });
const arc = (fromId: number, toId: number) =>
  ({ from: airport(fromId), to: airport(toId) }) as FlightArc;
const track = (flightId: number, fromId: number, toId: number) =>
  ({ ...arc(fromId, toId), flightId, samples: [] }) as FlightTrackPath;
const context = (
  overrides: Partial<RouteInteractionContext> = {},
): RouteInteractionContext => ({
  selectedAirportId: null,
  selectedRoute: null,
  ...overrides,
});

describe('flight track interaction', () => {
  it('distinguishes the hovered track from other tracks on its route', () => {
    const hoveredArc = track(10, 1, 2);

    expect(
      resolveRouteInteraction(hoveredArc, context({ hoveredArc })),
    ).toEqual({ emphasis: 'primary', opacity: 255 });
    expect(
      resolveRouteInteraction(track(11, 2, 1), context({ hoveredArc })),
    ).toEqual({ emphasis: 'secondary', opacity: 255 });
    expect(
      resolveRouteInteraction(track(12, 3, 4), context({ hoveredArc })),
    ).toEqual({ emphasis: 'dimmed', opacity: 200 });
    expect(resolveRouteInteraction(arc(1, 2), context({ hoveredArc }))).toEqual(
      { emphasis: 'primary', opacity: 255 },
    );
  });

  it('uses explicit opacity for selected-route dimming', () => {
    const state = resolveRouteInteraction(
      arc(3, 4),
      context({ selectedRoute: { a: '1', b: '2' } }),
    );

    expect(state).toEqual({ emphasis: 'dimmed', opacity: 170 });
    expect(applyFlightTrackInteractionColor(state, [1, 2, 3])).toEqual([
      113, 113, 122, 170,
    ]);
    expect(getEstimatedTrackUnderlayColor(state)).toEqual([0, 0, 0, 51]);
  });
});
