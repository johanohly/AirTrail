import type { CreateFlight, User } from '$lib/db/types';

export type FlightImportMode = 'personal' | 'restore';

type FlightImportSeat = Pick<
  CreateFlight['seats'][number],
  'userId' | 'guestName' | 'seat' | 'seatNumber' | 'seatClass'
>;

const flightImportSeatKey = (seat: FlightImportSeat) =>
  seat.userId
    ? JSON.stringify(['user', seat.userId])
    : JSON.stringify([
        'guest',
        seat.guestName,
        seat.seat,
        seat.seatNumber,
        seat.seatClass,
      ]);

export const getMissingImportSeats = <Seat extends FlightImportSeat>(
  existingSeats: readonly FlightImportSeat[],
  incomingSeats: readonly Seat[],
): Seat[] => {
  const remainingExisting = new Map<string, number>();
  for (const seat of existingSeats) {
    const key = flightImportSeatKey(seat);
    remainingExisting.set(key, (remainingExisting.get(key) ?? 0) + 1);
  }

  const seenIncomingUsers = new Set<string>();
  const missingSeats: Seat[] = [];
  for (const seat of incomingSeats) {
    const key = flightImportSeatKey(seat);

    if (seat.userId) {
      if (seenIncomingUsers.has(key)) continue;
      seenIncomingUsers.add(key);
    }

    const remaining = remainingExisting.get(key) ?? 0;
    if (remaining > 0) {
      remainingExisting.set(key, remaining - 1);
      continue;
    }

    missingSeats.push(seat);
  }

  return missingSeats;
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
