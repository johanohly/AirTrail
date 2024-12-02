import type { api_key, flight, seat, user } from '$lib/db/schema';

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
export type Seat = Omit<seat, 'id'> & {
  id: number;
};
export type Flight = Omit<flight, 'id'> & {
  id: number;
  seats: Seat[];
};
export type CreateFlight = Omit<Flight, 'id' | 'seats'> & {
  seats: Omit<Seat, 'flightId' | 'id'>[];
};

export const SeatTypes = ['window', 'aisle', 'middle', 'other'] as const;
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
