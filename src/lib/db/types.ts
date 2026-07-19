import type {
  aircraft,
  airline,
  airport,
  api_key,
  flight,
  flight_track,
  public_share,
  flight_passenger,
  user,
  visited_country,
} from '$lib/db/schema';
import type { FlightTrackInput } from '$lib/track/schema';
import type { Insertable, Selectable } from 'kysely';

export type FullUser = Selectable<user>;
export type User = Omit<FullUser, 'password'>;
export const publicUserFields = [
  'id',
  'username',
  'displayName',
  'role',
  'distanceUnit',
  'windSpeedUnit',
  'temperatureUnit',
  'pressureUnit',
  'timeFormat',
  'dateFormat',
  'weekStartsOn',
  'flightTimeDisplay',
] as const satisfies readonly (keyof User)[];
export type PublicUser = Pick<User, (typeof publicUserFields)[number]>;
export type PageUser = PublicUser & { hasOAuthLinked: boolean };
export type ApiKey = Omit<Selectable<api_key>, 'key' | 'userId'>;
export type Aircraft = Selectable<aircraft>;
export type Airline = Selectable<airline>;
export type Airport = Selectable<airport>;
export type CreateAirport = Insertable<airport>;
export type FlightPassengerRecord = Selectable<flight_passenger>;
export type FlightPassenger = FlightPassengerRecord & {
  user: Pick<User, 'id' | 'displayName' | 'username'> | null;
};
export type Flight = Omit<
  Selectable<flight>,
  'fromId' | 'toId' | 'aircraftId' | 'airlineId'
> & {
  from: Airport | null;
  to: Airport | null;
  passengers: FlightPassenger[];
  aircraft: Aircraft | null;
  airline: Airline | null;
};
export type FlightTrack = Selectable<flight_track>;
type CreateFlightAirport = Partial<Airport>;
type FlightRecord = Omit<
  Selectable<flight>,
  'id' | 'fromId' | 'toId' | 'aircraftId' | 'airlineId'
>;
export type CreateFlight = FlightRecord & {
  from: CreateFlightAirport | null;
  to: CreateFlightAirport | null;
  aircraft: Aircraft | null;
  airline: Airline | null;
  passengers: Omit<FlightPassengerRecord, 'flightId' | 'id'>[];
  track?: FlightTrackInput | null;
};
export type PublicShare = Selectable<public_share>;
export type VisitedCountry = Selectable<visited_country>;

export function wasVisited(country: Pick<VisitedCountry, 'status'>): boolean {
  return country.status === 'visited' || country.status === 'lived';
}

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
export const FlightDatePrecisions = ['day', 'month', 'year'] as const;
export type FlightDatePrecision = (typeof FlightDatePrecisions)[number];

export const VisitedCountryStatus = [
  'lived',
  'visited',
  'layover',
  'wishlist',
] as const;
