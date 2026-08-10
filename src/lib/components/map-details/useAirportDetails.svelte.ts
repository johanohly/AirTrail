import type { FlightFilters } from '$lib/components/flight-filters/types';
import type { NavigateFlights } from '$lib/flight-navigation';
import { mapDetailsState, openFlightDetails } from '$lib/state.svelte';
import { prepareVisitedAirports, type FlightData } from '$lib/utils';

export function useAirportDetails(
  flights: () => FlightData[],
  filters: () => FlightFilters | undefined,
  onNavigate: NavigateFlights,
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

  const showDepartures = () => {
    if (!airport) return;
    onNavigate({
      destination: 'list',
      focus: {
        type: 'airport',
        airportId: airport.id,
        direction: 'departure',
      },
    });
  };

  const showArrivals = () => {
    if (!airport) return;
    onNavigate({
      destination: 'list',
      focus: {
        type: 'airport',
        airportId: airport.id,
        direction: 'arrival',
      },
    });
  };

  const showFlight = (flightId: number) => {
    openFlightDetails(flightId);
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
    showFlight,
  };
}
