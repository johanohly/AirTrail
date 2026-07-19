import {
  routeMatchesEndpoints,
  type Route,
} from '$lib/components/flight-filters/types';

export const canShowFlightOnMap = (flight: {
  from: unknown | null;
  to: unknown | null;
}) => flight.from !== null && flight.to !== null;

export const includeFocusedRouteOnMap = <
  T extends {
    id: number;
    from: { id: number } | null;
    to: { id: number } | null;
  },
>(
  filteredFlights: T[],
  allFlights: T[],
  route: Route | null,
) => {
  if (!route) return filteredFlights;

  const visibleIds = new Set(filteredFlights.map((flight) => flight.id));
  const routeFlights = allFlights.filter((flight) => {
    if (!flight.from || !flight.to || visibleIds.has(flight.id)) return false;
    return routeMatchesEndpoints(flight.from.id, flight.to.id, route);
  });

  return routeFlights.length
    ? [...filteredFlights, ...routeFlights]
    : filteredFlights;
};

export const includeFocusedFlightInList = <T extends { id: number }>(
  filteredFlights: T[],
  allFlights: T[],
  focusedFlightId: number | null,
) => {
  if (
    focusedFlightId === null ||
    filteredFlights.some((flight) => flight.id === focusedFlightId)
  ) {
    return {
      flights: filteredFlights,
      focusedFlightOutsideFilters: false,
    };
  }

  const focusedFlight = allFlights.find(
    (flight) => flight.id === focusedFlightId,
  );
  if (!focusedFlight) {
    return {
      flights: filteredFlights,
      focusedFlightOutsideFilters: false,
    };
  }

  return {
    flights: [...filteredFlights, focusedFlight],
    focusedFlightOutsideFilters: true,
  };
};
