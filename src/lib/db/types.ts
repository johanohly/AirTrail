import type {
  aircraft,
  airline,
  airport,
  api_key,
  flight,
  public_share,
  seat,
  user,
} from '$lib/db/schema';
import type { Selectable } from 'kysely';

export type FullUser = Selectable<user>;
export type User = Omit<FullUser, 'password'>;
export type ApiKey = Omit<Selectable<api_key>, 'key' | 'userId'>;
export type Aircraft = Selectable<aircraft>;
export type Airline = Selectable<airline>;
export type Airport = Selectable<airport>;
export type Seat = Selectable<seat>;
export type Flight = Omit<
  Selectable<flight>,
  'fromId' | 'toId' | 'aircraftId' | 'airlineId'
> & {
  from: Airport | null;
  to: Airport | null;
  seats: Seat[];
  aircraft: Aircraft | null;
  airline: Airline | null;
};
type CreateFlightAirport = Partial<Airport>;
export type CreateFlight = Omit<Flight, 'id' | 'seats'> & {
  from: CreateFlightAirport;
  to: CreateFlightAirport;
  aircraft: Aircraft | null;
  airline: Airline | null;
  seats: Omit<Seat, 'flightId' | 'id'>[];
};
export type PublicShare = Selectable<public_share>;

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
