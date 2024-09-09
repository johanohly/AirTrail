import type { flight, user } from '$lib/db/schema';

export type ServerUser = user;
export type User = Omit<ServerUser, 'password'>;
export type Flight = Omit<flight, 'id'> & {
  id: number;
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
