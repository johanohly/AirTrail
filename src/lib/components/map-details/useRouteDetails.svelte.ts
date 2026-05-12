import { page } from '$app/state';
import type {
  FlightFilters,
  Route,
  TempFilters,
} from '$lib/components/flight-filters/types';
import {
  normalizeRoute,
  setTempRoute,
} from '$lib/components/flight-filters/types';
import {
  focusFlightInList,
  mapDetailsState,
  openModalsState,
} from '$lib/state.svelte';
import { type FlightData } from '$lib/utils';
import { formatAsFlightDate } from '$lib/utils/datetime';
import { convertDistance, getPreferences } from '$lib/utils/preferences';

export function useRouteDetails(
  flights: () => FlightData[],
  filters: () => FlightFilters | undefined,
  tempFilters: () => TempFilters | undefined,
) {
  const prefs = $derived(getPreferences(page.data.user));

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => {
      now = new Date();
    }, 30_000);
    return () => clearInterval(id);
  });

  const selectedRoute = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'route' ? selection.route : null;
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
    return formatAsFlightDate(
      flight.date,
      flight.datePrecision ?? 'day',
      false,
      true,
    );
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

  const showAllFlights = (flightId?: number) => {
    const tf = tempFilters();
    if (selectedRoute && tf) setTempRoute(tf, selectedRoute);
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
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
  };
}
