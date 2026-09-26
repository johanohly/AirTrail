import {
  hasClientPermission,
  type Permission,
} from '$lib/authorization/permissions';

type ClientAuthorization = {
  isOwner: boolean;
  permissions: Permission[];
} | null;

type FlightWithPassengers = {
  passengers: readonly { userId: string | null }[];
};

export const createFlightListAccess = ({
  authorization,
  userId,
  readonly,
}: {
  authorization: ClientAuthorization;
  userId: string | null;
  readonly: boolean;
}) => {
  const has = (permission: Permission) =>
    !readonly && hasClientPermission(authorization, permission);
  const canUpdateAny = has('flight.update.any');
  const canUpdateOwn = has('flight.update.own');
  const canDeleteAny = has('flight.delete.any');
  const canDeleteOwn = has('flight.delete.own');
  const isOwnFlight = (flight: FlightWithPassengers) =>
    Boolean(
      userId &&
      flight.passengers.some((passenger) => passenger.userId === userId),
    );
  const canUpdateFlight = (flight: FlightWithPassengers) =>
    canUpdateAny || (canUpdateOwn && isOwnFlight(flight));
  const canDeleteFlight = (flight: FlightWithPassengers) =>
    canDeleteAny || (canDeleteOwn && isOwnFlight(flight));

  return {
    canCreateFlight: has('flight.create.own'),
    canUpdateFlight,
    canDeleteFlight,
    canBulkDelete: (flights: readonly FlightWithPassengers[]) =>
      flights.length > 0 && flights.every(canDeleteFlight),
  };
};
