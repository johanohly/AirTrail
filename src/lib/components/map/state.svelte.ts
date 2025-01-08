import { prepareFlightArcData, prepareVisitedAirports } from '$lib/utils';

/**
 * The choices are, the below or a class with two fields each being a $state.raw.
 * The latter solution would be preferable if it didn't cause this error when built in a Docker environment: https://github.com/evanw/esbuild/issues/3287
 */
export const hoverInfo: {
  hoveredArc: ReturnType<typeof prepareFlightArcData>[number] | null;
  hoveredAirport: ReturnType<typeof prepareVisitedAirports>[number] | null;
} = $state({
  hoveredArc: null,
  hoveredAirport: null,
});
