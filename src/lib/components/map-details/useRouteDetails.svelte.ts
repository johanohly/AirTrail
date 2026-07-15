import { page } from '$app/state';
import type {
  FlightFilters,
  Route,
  TempFilters,
} from '$lib/components/flight-filters/types';
import { normalizeRoute } from '$lib/components/flight-filters/types';
import {
  mapDetailsState,
  openFlightDetails,
  openRouteInList,
} from '$lib/state.svelte';
import { type FlightData } from '$lib/utils';
import {
  convertDistance,
  formatCompactFlightDate,
  getPreferences,
} from '$lib/utils/preferences';

export function useRouteDetails(
  flights: () => FlightData[],
  filters: () => FlightFilters | undefined,
  tempFilters: () => TempFilters | undefined,
) {
  const prefs = $derived(getPreferences(page.data.user));

  let now = $state(new Date());

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
  });

  $effect(() => {
    if (!selectedRoute) return;
    now = new Date();
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
  });

  const matchesRoute = (flight: FlightData, route: Route) => {
    const fromId = flight.from?.id.toString();
    const toId = flight.to?.id.toString();
    return (
      (fromId === route.a && toId === route.b) ||
      (fromId === route.b && toId === route.a)
    );
  };

  const routeFlights = $derived.by(() => {
    if (!selectedRoute) return [];
    return flights()
      .filter((flight) => matchesRoute(flight, selectedRoute))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  });

  const routeAirports = $derived.by(() => {
    if (!selectedRoute) return null;
    const flight = routeFlights.find((f) => f.from && f.to);
    if (!flight?.from || !flight.to) return null;

    if (flight.from.id.toString() === selectedRoute.a) {
      return { from: flight.from, to: flight.to };
    }
    return { from: flight.to, to: flight.from };
  });

  const airlineCount = $derived.by(() => {
    const ids = new Set<number>();
    for (const flight of routeFlights) {
      if (flight.airline) ids.add(flight.airline.id);
    }
    return ids.size;
  });

  const distance = $derived.by(() => {
    const km = routeFlights.find(
      (f) => typeof f.distance === 'number',
    )?.distance;
    if (typeof km !== 'number') return null;
    return Math.round(convertDistance(km, prefs));
  });

  const lastFlownLabel = $derived.by(() => {
    const flight = routeFlights.find((f) => f.date);
    if (!flight?.date) return null;
    return formatCompactFlightDate(flight.date, flight.datePrecision ?? 'day');
  });

  const routeFilterActive = $derived.by(() => {
    const f = filters();
    if (!f || !selectedRoute) return false;
    return (
      f.routes.length === 1 &&
      f.routes[0]?.a === selectedRoute.a &&
      f.routes[0]?.b === selectedRoute.b &&
      f.departureAirports.length === 0 &&
      f.arrivalAirports.length === 0 &&
      f.airportsEither.length === 0
    );
  });

  const toggleRouteFilter = () => {
    const f = filters();
    if (!f || !selectedRoute) return;

    if (routeFilterActive) {
      f.routes = [];
      return;
    }

    f.departureAirports = [];
    f.arrivalAirports = [];
    f.airportsEither = [];
    f.routes = [normalizeRoute(selectedRoute.a, selectedRoute.b)];
  };

  const showAllFlights = () => {
    if (!selectedRoute) return;
    openRouteInList(tempFilters(), selectedRoute);
  };

  const showFlight = (flightId: number) => {
    // Open the flight's details pane; while it's open the map isolates that
    // flight (a derived view of the pane state, not a persistent filter).
    openFlightDetails(flightId);
  };

  return {
    get prefs() {
      return prefs;
    },
    get now() {
      return now;
    },
    get selectedRoute() {
      return selectedRoute;
    },
    get routeFlights() {
      return routeFlights;
    },
    get routeAirports() {
      return routeAirports;
    },
    get airlineCount() {
      return airlineCount;
    },
    get distance() {
      return distance;
    },
    get lastFlownLabel() {
      return lastFlownLabel;
    },
    get routeFilterActive() {
      return routeFilterActive;
    },
    toggleRouteFilter,
    showAllFlights,
    showFlight,
  };
}
