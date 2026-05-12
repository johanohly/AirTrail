import type {
  FlightFilters,
  TempFilters,
} from '$lib/components/flight-filters/types';
import {
  setTempArrivalAirport,
  setTempDepartureAirport,
} from '$lib/components/flight-filters/types';
import {
  focusFlightInList,
  mapDetailsState,
  openModalsState,
} from '$lib/state.svelte';
import { prepareVisitedAirports, type FlightData } from '$lib/utils';

export function useAirportDetails(
  flights: () => FlightData[],
  filters: () => FlightFilters | undefined,
  tempFilters: () => TempFilters | undefined,
) {
  const selectedAirportId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'airport' ? selection.airportId : null;
  });

  const visited = $derived(prepareVisitedAirports(flights()));

  const airport = $derived.by(() => {
    const id = selectedAirportId;
    if (id === null) return null;
    return visited.find((a) => a.id === id) ?? null;
  });

  const relatedFlights = $derived.by(() => {
    const id = selectedAirportId;
    if (id === null) return [];
    return flights().filter((f) => f.from?.id === id || f.to?.id === id);
  });

  const airportFilterActive = $derived.by(() => {
    const f = filters();
    if (!f || !airport) return false;
    return (
      f.airportsEither.length === 1 &&
      f.airportsEither[0] === airport.id.toString() &&
      f.departureAirports.length === 0 &&
      f.arrivalAirports.length === 0 &&
      f.routes.length === 0
    );
  });

  const toggleAirportFilter = () => {
    const f = filters();
    if (!f || !airport) return;

    if (airportFilterActive) {
      f.airportsEither = [];
      return;
    }

    f.departureAirports = [];
    f.arrivalAirports = [];
    f.routes = [];
    f.airportsEither = [airport.id.toString()];
  };

  const showDepartures = (flightId?: number) => {
    if (!airport) return;
    const tf = tempFilters();
    if (tf) setTempDepartureAirport(tf, airport.id.toString());
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
  };

  const showArrivals = (flightId?: number) => {
    if (!airport) return;
    const tf = tempFilters();
    if (tf) setTempArrivalAirport(tf, airport.id.toString());
    if (flightId) focusFlightInList(flightId);
    openModalsState.listFlights = true;
  };

  return {
    get airport() {
      return airport;
    },
    get relatedFlights() {
      return relatedFlights;
    },
    get airportFilterActive() {
      return airportFilterActive;
    },
    toggleAirportFilter,
    showDepartures,
    showArrivals,
  };
}
