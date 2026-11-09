import type {
  CreateFlightPassenger,
  DatabaseConnection,
  FlightPassenger,
} from '$lib/db/types';
import { FlightReasons } from '$lib/db/types';
import { resolveFlightPassengerChanges } from '$lib/db/queries';

export class FlightReasonValidationError extends Error {}

/** Only the caller can assign their personal custom choices. Stored reasons
 * remain valid on the same passenger after an option is removed from settings. */
export async function validatePassengerFlightReasons(
  db: DatabaseConnection,
  actorId: string,
  passengers: CreateFlightPassenger[],
  existing: FlightPassenger[] = [],
) {
  const { resolved } = resolveFlightPassengerChanges(existing, passengers);
  const savedById = new Map(
    existing.map((passenger) => [passenger.id, passenger]),
  );
  let customReasons: string[] | undefined;
  for (const { passenger, existing: matched } of resolved) {
    const reason = passenger.flightReason;
    if (reason === null || FlightReasons.some((builtin) => builtin === reason))
      continue;
    const saved = matched && savedById.get(matched.id);
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
}
