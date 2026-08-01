import {
  createDefaultTempFilters,
  setTempArrivalAirport,
  setTempDepartureAirport,
  setTempRoute,
  type Route,
  type TempFilters,
} from '$lib/components/flight-filters/types';

export type FlightListFocus =
  | { type: 'flight'; flightId: number }
  | { type: 'route'; route: Route }
  | {
      type: 'airport';
      airportId: number;
      direction: 'departure' | 'arrival';
    };

export type FlightNavigationIntent =
  | { destination: 'list'; focus: FlightListFocus }
  | {
      destination: 'map';
      focus: { type: 'flight'; flightId: number };
    };

export type NavigateFlights = (
  intent: FlightNavigationIntent,
) => void | Promise<void>;

export type FlightNavigationState = {
  tempFilters: TempFilters;
  focusedListFlightId: number | null;
  listOpen: boolean;
  statisticsOpen: boolean;
};

type FlightNavigationTransition = {
  state: FlightNavigationState;
  focusFlightId?: number;
  detailFlightId?: number;
};

export type FlightNavigatorDependencies = {
  getState: () => FlightNavigationState;
  commitState: (state: FlightNavigationState) => void;
  focusFlightInList: (flightId: number) => void;
  waitForModalClose: () => Promise<void>;
  openFlightDetails: (flightId: number) => void;
};

export const planFlightNavigation = (
  intent: FlightNavigationIntent,
  current: FlightNavigationState,
): FlightNavigationTransition => {
  const tempFilters = createDefaultTempFilters();

  if (intent.destination === 'map') {
    return {
      state: {
        tempFilters,
        focusedListFlightId: null,
        listOpen: false,
        statisticsOpen: false,
      },
      detailFlightId: intent.focus.flightId,
    };
  }

  const focus = intent.focus;
  let focusFlightId: number | undefined;
  if (focus.type === 'route') {
    setTempRoute(tempFilters, focus.route);
  } else if (focus.type === 'airport') {
    const setAirport =
      focus.direction === 'departure'
        ? setTempDepartureAirport
        : setTempArrivalAirport;
    setAirport(tempFilters, focus.airportId.toString());
  } else {
    focusFlightId = focus.flightId;
  }

  return {
    state: {
      tempFilters,
      focusedListFlightId: focusFlightId ?? null,
      listOpen: true,
      statisticsOpen: current.statisticsOpen,
    },
    focusFlightId,
  };
};

export const createFlightNavigator = (
  dependencies: FlightNavigatorDependencies,
): NavigateFlights => {
  return async (intent) => {
    const transition = planFlightNavigation(intent, dependencies.getState());
    dependencies.commitState(transition.state);
    if (transition.focusFlightId !== undefined) {
      dependencies.focusFlightInList(transition.focusFlightId);
    }
    if (transition.detailFlightId === undefined) return;

    await dependencies.waitForModalClose();
    dependencies.openFlightDetails(transition.detailFlightId);
  };
};
