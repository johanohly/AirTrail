import type { Selectable } from 'kysely';
import type {
  custom_field_definition,
  public_share,
  visited_country,
} from '$lib/db/schema';
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

/*
 * Explicit projections, so a new column (or `userId`) never becomes part of the
 * public contract by accident.
 */
export const toShareDto = (share: Selectable<public_share>) => ({
  id: share.id,
  slug: share.slug,
  expiresAt: share.expiresAt,
  createdAt: share.createdAt,
  showMap: share.showMap,
  showStats: share.showStats,
  showFlightList: share.showFlightList,
  dateFrom: share.dateFrom,
  dateTo: share.dateTo,
  showFlightNumbers: share.showFlightNumbers,
  showAirlines: share.showAirlines,
  showAircraft: share.showAircraft,
  showTimes: share.showTimes,
  showTracks: share.showTracks,
  showDates: share.showDates,
  showSeat: share.showSeat,
});

export const toVisitedCountryDto = (country: Selectable<visited_country>) => ({
  id: country.id,
  code: country.code,
  status: country.status,
  note: country.note,
});

export const toCustomFieldDto = (
  field: Selectable<custom_field_definition>,
) => ({
  id: field.id,
  entityType: field.entityType,
  key: field.key,
  label: field.label,
  description: field.description,
  fieldType: field.fieldType,
  required: field.required,
  order: field.order,
  defaultValue: field.defaultValue,
  options: field.options,
});
