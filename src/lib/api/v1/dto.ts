import type {
  Aircraft,
  Airline,
  Airport,
  Flight,
  FlightPassenger,
  User,
} from '$lib/db/types';

export const toAirportDto = (airport: Airport | null) =>
  airport
    ? {
        id: airport.id,
        icao: airport.icao,
        iata: airport.iata,
        name: airport.name,
        municipality: airport.municipality,
        latitude: airport.lat,
        longitude: airport.lon,
        timezone: airport.tz,
        type: airport.type,
        continent: airport.continent,
        country: airport.country,
        custom: airport.custom,
      }
    : null;

export const toAirlineDto = (airline: Airline | null) =>
  airline
    ? {
        id: airline.id,
        name: airline.name,
        icao: airline.icao,
        iata: airline.iata,
        iconPath: airline.iconPath,
      }
    : null;

export const toAircraftDto = (aircraft: Aircraft | null) =>
  aircraft
    ? {
        id: aircraft.id,
        name: aircraft.name,
        icao: aircraft.icao,
      }
    : null;

export const toUserDto = (user: User) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
});

export const toPassengerDto = (passenger: FlightPassenger) => ({
  id: passenger.id,
  user: passenger.user,
  guestName: passenger.guestName,
  seat: passenger.seat,
  seatNumber: passenger.seatNumber,
  seatClass: passenger.seatClass,
  flightReason: passenger.flightReason,
});

export type FlightTrackSummary = {
  pointCount: number;
  updatedAt: string;
  sourceFormat: string;
  sourceName: string | null;
};

export const toFlightDto = (
  flight: Flight,
  track: FlightTrackSummary | null = null,
) => ({
  id: flight.id,
  date: flight.date,
  datePrecision: flight.datePrecision,
  departure: flight.departure,
  arrival: flight.arrival,
  departureScheduled: flight.departureScheduled,
  arrivalScheduled: flight.arrivalScheduled,
  takeoffScheduled: flight.takeoffScheduled,
  takeoffActual: flight.takeoffActual,
  landingScheduled: flight.landingScheduled,
  landingActual: flight.landingActual,
  duration: flight.duration,
  departureTerminal: flight.departureTerminal,
  departureGate: flight.departureGate,
  arrivalTerminal: flight.arrivalTerminal,
  arrivalGate: flight.arrivalGate,
  flightNumber: flight.flightNumber,
  aircraftReg: flight.aircraftReg,
  note: flight.note,
  from: toAirportDto(flight.from),
  to: toAirportDto(flight.to),
  airline: toAirlineDto(flight.airline),
  aircraft: toAircraftDto(flight.aircraft),
  passengers: flight.passengers.map(toPassengerDto),
  track,
});
