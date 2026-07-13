import type { CreateFlight, User } from '$lib/db/types';

export type FlightImportMode = 'personal' | 'restore';

export const validateFlightImportPermissions = (
  user: Pick<User, 'id' | 'role'>,
  flights: CreateFlight[],
  mode: FlightImportMode,
): string | null => {
  if (mode === 'restore') {
    return user.role === 'user'
      ? 'Only admins and owners can restore flights for other users'
      : null;
  }

  for (const [index, flight] of flights.entries()) {
    if (
      flight.seats.some(
        (seat) => seat.userId != null && seat.userId !== user.id,
      )
    ) {
      return `Flight ${index + 1} assigns a seat to another user`;
    }

    if (!flight.seats.some((seat) => seat.userId === user.id)) {
      return `Flight ${index + 1} must include the importing user`;
    }
  }

  return null;
};
