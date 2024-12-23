import { prepareFlightArcData, prepareVisitedAirports } from '$lib/utils';

export const hoverInfo = $state<{
  hoveredArc: ReturnType<typeof prepareFlightArcData>[number] | null;
  hoveredAirport: ReturnType<typeof prepareVisitedAirports>[number] | null;
}>({
  hoveredArc: null,
  hoveredAirport: null,
});
