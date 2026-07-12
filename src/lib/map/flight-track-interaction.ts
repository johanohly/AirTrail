import type { Color } from '@deck.gl/core';

import type { Route } from '$lib/components/flight-filters/types';

import {
  getRouteKey,
  routeMatchesArc,
  type FlightArc,
  type FlightTrackPath,
} from './flight-layer-data';

export type RouteInteraction = {
  emphasis: 'normal' | 'primary' | 'secondary' | 'dimmed';
  opacity: number;
};

export type RouteInteractionContext = {
  hoveredArc?: FlightArc | FlightTrackPath;
  hoveredAirportId?: number;
  selectedAirportId: number | null;
  selectedRoute: Route | null;
};

const interaction = (
  emphasis: RouteInteraction['emphasis'],
  opacity = 255,
): RouteInteraction => ({ emphasis, opacity });

const arcsShareRoute = (left: FlightArc, right: FlightArc) =>
  getRouteKey(left.from.id, left.to.id) ===
  getRouteKey(right.from.id, right.to.id);

export const resolveRouteInteraction = (
  arc: FlightArc,
  context: RouteInteractionContext,
): RouteInteraction => {
  const { hoveredArc, hoveredAirportId, selectedAirportId, selectedRoute } =
    context;
  const hoveredTrackFlightId =
    hoveredArc && 'flightId' in hoveredArc ? hoveredArc.flightId : undefined;

  if (hoveredTrackFlightId !== undefined) {
    if ('flightId' in arc && arc.flightId === hoveredTrackFlightId) {
      return interaction('primary');
    }
    if (!('flightId' in arc) && hoveredArc && arcsShareRoute(arc, hoveredArc)) {
      return interaction('primary');
    }
    return hoveredArc && arcsShareRoute(arc, hoveredArc)
      ? interaction('secondary')
      : interaction('dimmed', 200);
  }

  if (
    (hoveredArc?.from === arc.from && hoveredArc?.to === arc.to) ||
    routeMatchesArc(arc, selectedRoute)
  ) {
    return interaction('primary');
  }
  if (hoveredArc) return interaction('dimmed', 200);
  if (hoveredAirportId !== undefined) {
    return hoveredAirportId === arc.from.id || hoveredAirportId === arc.to.id
      ? interaction('normal')
      : interaction('dimmed', 200);
  }
  if (selectedAirportId) {
    return selectedAirportId === arc.from.id || selectedAirportId === arc.to.id
      ? interaction('normal')
      : interaction('dimmed', 170);
  }
  return selectedRoute ? interaction('dimmed', 170) : interaction('normal');
};

const PRIMARY_COLOR: Color = [16, 185, 129];
const SECONDARY_COLOR: Color = [14, 165, 233];
const INACTIVE_COLOR = (alpha: number): Color => [113, 113, 122, alpha];

export const applyFlightTrackInteractionColor = (
  state: RouteInteraction,
  baseColor: Color,
): Color => {
  if (state.emphasis === 'primary') return PRIMARY_COLOR;
  if (state.emphasis === 'secondary') return SECONDARY_COLOR;
  if (state.emphasis === 'dimmed') return INACTIVE_COLOR(state.opacity);
  return baseColor;
};

export const getEstimatedTrackUnderlayColor = (
  state: RouteInteraction,
): Color => [
  0,
  0,
  0,
  state.emphasis === 'dimmed' ? Math.round(state.opacity * 0.3) : 176,
];

export const getGroundTrackCasingColor = (
  state: RouteInteraction,
  darkMode: boolean,
): Color => {
  const alpha =
    state.emphasis === 'dimmed' ? Math.round(state.opacity * 0.75) : 220;
  return darkMode ? [9, 9, 11, alpha] : [250, 250, 250, alpha];
};
