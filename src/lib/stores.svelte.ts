import type { FlightData } from "./utils";

export const openModalsState = $state({
  addFlight: false,
  listFlights: false,
  statistics: false,
  settings: false,
});

export const filteredMapFlightsState = $state({flightData: [] as FlightData[]});
