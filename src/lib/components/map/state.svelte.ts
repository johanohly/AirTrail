import { prepareFlightArcData, prepareVisitedAirports } from '$lib/utils';

class HoverInfo {
  hoveredArc: ReturnType<typeof prepareFlightArcData>[number] | null =
    $state.raw(null);
  hoveredAirport: ReturnType<typeof prepareVisitedAirports>[number] | null =
    $state.raw(null);
}
export const hoverInfo = new HoverInfo();
