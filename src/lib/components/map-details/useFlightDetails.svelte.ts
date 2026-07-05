import { page } from '$app/state';
import type { FlightFilters } from '$lib/components/flight-filters/types';
import { mapDetailsState, openRouteDetails } from '$lib/state.svelte';
import { type FlightData } from '$lib/utils';
import { getPreferences } from '$lib/utils/preferences';

export function useFlightDetails(
  flights: () => FlightData[],
  filters: () => FlightFilters | undefined,
) {
  const prefs = $derived(getPreferences(page.data.user));

  const selectedFlightId = $derived.by(() => {
    const selection = mapDetailsState.selection;
    return selection?.type === 'flight' ? selection.flightId : null;
  });

  const flight = $derived.by(() => {
    const id = selectedFlightId;
    if (id === null) return null;
    return flights().find((f) => f.id === id) ?? null;
  });

  const flightFilterActive = $derived.by(() => {
    const f = filters();
    if (!f || !flight) return false;
    return (
      f.flightIds.length === 1 &&
      f.flightIds[0] === flight.id.toString() &&
      f.departureAirports.length === 0 &&
      f.arrivalAirports.length === 0 &&
      f.airportsEither.length === 0 &&
      f.routes.length === 0
    );
  });

  const toggleFlightFilter = () => {
    const f = filters();
    if (!f || !flight) return;

    if (flightFilterActive) {
      f.flightIds = [];
      return;
    }

    f.departureAirports = [];
    f.arrivalAirports = [];
    f.airportsEither = [];
    f.routes = [];
    f.flightIds = [flight.id.toString()];
  };

  const showRoute = () => {
    if (!flight?.from || !flight.to) return;
    // Drop the single-flight isolation so the route's flights are all visible
    // again, then swap the pane over to the route details.
    const f = filters();
    if (f) f.flightIds = [];
    openRouteDetails({
      a: flight.from.id.toString(),
      b: flight.to.id.toString(),
    });
  };

  return {
    get prefs() {
      return prefs;
    },
    get flight() {
      return flight;
    },
    get flightFilterActive() {
      return flightFilterActive;
    },
    toggleFlightFilter,
    showRoute,
  };
}
