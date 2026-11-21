import { resolveFlightPassengerChanges } from '$lib/db/queries';
import type {
  CreateFlightPassenger,
  DatabaseConnection,
  FlightPassenger,
} from '$lib/db/types';
import { isBuiltinFlightReason } from '$lib/utils/flight-reasons';

export class FlightReasonValidationError extends Error {}

/*
 * A custom reason can only be picked from the actor's own list, for their own
 * passenger row. A saved reason stays valid on the same passenger after it is
 * removed from that list, so editing an old flight doesn't force a change.
 */
export const validatePassengerFlightReasons = async (
  db: DatabaseConnection,
  actorId: string,
  passengers: CreateFlightPassenger[],
  existing: FlightPassenger[] = [],
) => {
  // A new flight has nothing to match, and its passengers may still carry the
  // ids of the flight they were copied from.
  const resolved = existing.length
    ? resolveFlightPassengerChanges(existing, passengers).resolved
    : passengers.map((passenger) => ({ passenger, existing: undefined }));
  let customReasons: string[] | undefined;
  for (const { passenger, existing: matched } of resolved) {
    const reason = passenger.flightReason;
    if (reason === null || isBuiltinFlightReason(reason)) continue;
    const saved = matched && existing.find((row) => row.id === matched.id);
    if (
      saved &&
      saved.userId === passenger.userId &&
      saved.guestName === passenger.guestName &&
      saved.flightReason === reason
    )
      continue;
    if (passenger.userId === actorId) {
      customReasons ??= (
        await db
          .selectFrom('user')
          .select('customFlightReasons')
          .where('id', '=', actorId)
          .executeTakeFirstOrThrow()
      ).customFlightReasons;
      if (customReasons.includes(reason)) continue;
    }
    throw new FlightReasonValidationError(
      'Select an available flight reason for this passenger',
    );
  }
};
