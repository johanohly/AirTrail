import type {
  aircraft,
  airline,
  airport,
  api_key,
  flight,
  seat,
  user,
} from '$lib/db/schema';

export type ServerUser = user;
export type User = Omit<ServerUser, 'password'>;
export type ApiKey = Omit<
  api_key,
  'id' | 'key' | 'userId' | 'createdAt' | 'lastUsed'
> & {
  id: number;
  createdAt: Date;
  lastUsed: Date | null;
};
export type Aircraft = Omit<aircraft, 'id'> & {
  id: number;
};
export type Airline = Omit<airline, 'id'> & {
  id: number;
};
export type Airport = Omit<airport, 'id' | 'custom'> & {
  id: number;
  custom: boolean;
};
export type Seat = Omit<seat, 'id'> & {
  id: number;
};
export type Flight = Omit<
  flight,
  'id' | 'fromId' | 'toId' | 'aircraftId' | 'airlineId'
> & {
  id: number;
  from: Airport;
  to: Airport;
  seats: Seat[];
  aircraft: Aircraft | null;
  airline: Airline | null;
};
type CreateFlightAirport = Partial<Omit<Airport, 'id'>> & {
  id: number;
};
export type CreateFlight = Omit<Flight, 'id' | 'seats'> & {
  from: CreateFlightAirport;
  to: CreateFlightAirport;
  aircraft: Aircraft | null;
  airline: Airline | null;
  seats: Omit<Seat, 'flightId' | 'id'>[];
};

export const AirportTypes = [
  'small_airport',
  'medium_airport',
  'large_airport',
  'heliport',
  'balloonport',
  'seaplane_base',
  'closed',
] as const;
export const Continents = ['AF', 'AS', 'EU', 'NA', 'OC', 'SA', 'AN'] as const;
export const ContinentMap = {
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  AS: 'Asia',
  AF: 'Africa',
  OC: 'Oceania',
  AN: 'Antarctica',
};

export const SeatTypes = [
  'window',
  'aisle',
  'middle',
  'pilot',
  'copilot',
  'jumpseat',
  'other',
] as const;
export const SeatClasses = [
  'economy',
  'economy+',
  'business',
  'first',
  'private',
] as const;
export const FlightReasons = ['leisure', 'business', 'crew', 'other'] as const;

export const VisitedCountryStatus = [
  'lived',
  'visited',
  'layover',
  'wishlist',
] as const;
