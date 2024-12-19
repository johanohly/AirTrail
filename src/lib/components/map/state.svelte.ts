import { prepareFlightArcData, prepareVisitedAirports } from '$lib/utils';

class HoverInfo {
  hoveredArc = $state.raw<
    ReturnType<typeof prepareFlightArcData>[number] | null
  >(null);
  hoveredAirport = $state.raw<
    ReturnType<typeof prepareVisitedAirports>[number] | null
  >(null);
}
export const hoverInfo = new HoverInfo();
