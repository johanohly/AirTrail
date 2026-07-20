import type { CreateFlight, User } from '$lib/db/types';

export type FlightImportMode = 'personal' | 'restore';

type FlightImportPassenger = Pick<
  CreateFlight['passengers'][number],
  'userId' | 'guestName' | 'seat' | 'seatNumber' | 'seatClass'
>;

const flightImportPassengerKey = (passenger: FlightImportPassenger) =>
  passenger.userId
    ? JSON.stringify(['user', passenger.userId])
    : JSON.stringify([
        'guest',
        passenger.guestName,
        passenger.seat,
        passenger.seatNumber,
        passenger.seatClass,
      ]);

export const getMissingImportPassengers = <
  Passenger extends FlightImportPassenger,
>(
  existingPassengers: readonly FlightImportPassenger[],
  incomingPassengers: readonly Passenger[],
): Passenger[] => {
  const remainingExisting = new Map<string, number>();
  for (const passenger of existingPassengers) {
    const key = flightImportPassengerKey(passenger);
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  }

  const seenIncomingUsers = new Set<string>();
  const missingPassengers: Passenger[] = [];
  for (const passenger of incomingPassengers) {
    const key = flightImportPassengerKey(passenger);

    if (passenger.userId) {
      if (seenIncomingUsers.has(key)) continue;
      seenIncomingUsers.add(key);
    }

    const remaining = remainingExisting.get(key) ?? 0;
    if (remaining > 0) {
      remainingExisting.set(key, remaining - 1);
      continue;
    }

    missingPassengers.push(passenger);
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
        (passenger) => passenger.userId != null && passenger.userId !== user.id,
      )
    ) {
      return `Flight ${index + 1} assigns another user as a passenger`;
    }

    if (!flight.passengers.some((passenger) => passenger.userId === user.id)) {
      return `Flight ${index + 1} must include the importing user`;
    }
  }

  return null;
};
