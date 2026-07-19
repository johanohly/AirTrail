import { page } from '$app/state';
import type { NavigateFlights } from '$lib/flight-navigation';
import { mapDetailsState, openRouteDetails } from '$lib/state.svelte';
import { type FlightData } from '$lib/utils';
import { getPreferences } from '$lib/utils/preferences';

export function useFlightDetails(
  flights: () => FlightData[],
  onNavigate: NavigateFlights,
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

  const showRoute = () => {
    if (!flight?.from || !flight.to) return;
    // Swap the pane over to the route details; the map follows the pane, so it
    // returns to the whole route's flights on its own.
    openRouteDetails({
      a: flight.from.id.toString(),
      b: flight.to.id.toString(),
    });
  };

  const showInList = () => {
    if (!flight) return;
    onNavigate({
      destination: 'list',
      focus: { type: 'flight', flightId: flight.id },
    });
  };

  return {
    get prefs() {
      return prefs;
    },
    get flight() {
      return flight;
    },
    showRoute,
    showInList,
  };
}
