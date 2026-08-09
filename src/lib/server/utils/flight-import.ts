import type { CreateFlight, Flight } from '$lib/db/types';
import type { AuthorizationContext } from '$lib/server/authorization/context';
import { hasPermission } from '$lib/server/authorization/authorize';

export type FlightImportMode = 'personal' | 'restore';

export type MissingFlightReferenceUpdate = {
  airlineId?: number;
  aircraftId?: number;
};

export const getMissingFlightReferenceUpdate = (
  existing: Pick<Flight, 'airline' | 'aircraft'>,
  incoming: Pick<CreateFlight, 'airline' | 'aircraft'>,
): MissingFlightReferenceUpdate | null => {
  const update: MissingFlightReferenceUpdate = {};

  if (!existing.airline && incoming.airline?.id != null) {
    update.airlineId = incoming.airline.id;
  }
  if (!existing.aircraft && incoming.aircraft?.id != null) {
    update.aircraftId = incoming.aircraft.id;
  }

  return Object.keys(update).length ? update : null;
};

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
  authorization: AuthorizationContext,
  flights: CreateFlight[],
  mode: FlightImportMode,
): string | null => {
  if (mode === 'restore') {
    return hasPermission(authorization, 'flight.import.any')
      ? null
      : 'You cannot restore flights for other users';
  }

  if (!hasPermission(authorization, 'flight.import.own')) {
    return 'You cannot import flights';
  }

  for (const [index, flight] of flights.entries()) {
    if (
      flight.passengers.some(
        (passenger) =>
          passenger.userId != null && passenger.userId !== authorization.userId,
      )
    ) {
      return `Flight ${index + 1} assigns another user as a passenger`;
    }

    if (
      !flight.passengers.some(
        (passenger) => passenger.userId === authorization.userId,
      )
    ) {
      return `Flight ${index + 1} must include the importing user`;
    }
  }

  return null;
};
