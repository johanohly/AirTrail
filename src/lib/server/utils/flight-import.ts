import type { CreateFlight, User } from '$lib/db/types';

export type FlightImportMode = 'personal' | 'restore';

type FlightImportPassenger = Pick<
  CreateFlight['passengers'][number],
  'userId' | 'guestName' | 'seat' | 'seatNumber' | 'seatClass'
>;

const flightImportPassengerKey = (seat: FlightImportPassenger) =>
  seat.userId
    ? JSON.stringify(['user', seat.userId])
    : JSON.stringify([
        'guest',
        seat.guestName,
        seat.seat,
        seat.seatNumber,
        seat.seatClass,
      ]);

export const getMissingImportPassengers = <
  Passenger extends FlightImportPassenger,
>(
  existingPassengers: readonly FlightImportPassenger[],
  incomingPassengers: readonly Passenger[],
): Passenger[] => {
  const remainingExisting = new Map<string, number>();
  for (const seat of existingPassengers) {
    const key = flightImportPassengerKey(seat);
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  }

  const seenIncomingUsers = new Set<string>();
  const missingPassengers: Passenger[] = [];
  for (const seat of incomingPassengers) {
    const key = flightImportPassengerKey(seat);

    if (seat.userId) {
      if (seenIncomingUsers.has(key)) continue;
      seenIncomingUsers.add(key);
    }

    const remaining = remainingExisting.get(key) ?? 0;
    if (remaining > 0) {
      remainingExisting.set(key, remaining - 1);
      continue;
    }

    missingPassengers.push(seat);
  }

  return missingPassengers;
};

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
      flight.passengers.some(
        (seat) => seat.userId != null && seat.userId !== user.id,
      )
    ) {
      return `Flight ${index + 1} assigns a seat to another user`;
    }

    if (!flight.passengers.some((seat) => seat.userId === user.id)) {
      return `Flight ${index + 1} must include the importing user`;
    }
  }

  return null;
};
